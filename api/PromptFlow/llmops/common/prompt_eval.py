"""
This module evaluates bulk-runs using evaluation flows.

Args:
--subscription_id: The Azure subscription ID.
This argument is required for identifying the Azure subscription.
--build_id: The unique identifier for build execution.
This argument is required to identify the specific build execution.
--env_name: The environment name for execution/deployment.
This argument is required to specify the environment (dev, test, prod)
--data_purpose: The data identified by its purpose.
This argument is required to specify the purpose of the data.
--run_id: The bulk run IDs.
This argument is required to specify the bulk run IDs for execution.
--flow_to_execute: The name of the flow use case.
This argument is required to specify the name of the flow for execution.
"""

import argparse
import ast
import datetime
import json
import os
import time
import yaml
import pandas as pd
from azure.identity import DefaultAzureCredential
from promptflow.entities import Run
from promptflow.azure import PFClient

from llmops.common.logger import llmops_logger

logger = llmops_logger("prompt_eval")


def prepare_and_execute(
    subscription_id,
    build_id, stage,
    run_id,
    data_purpose,
    flow_to_execute
):
    """
    Run the evaluation loop by executing evaluation flows.

    reads latest evaluation data assets
    executes evaluation flow against each provided bulk-run
    executes the flow creating a new evaluation job
    saves the results in both csv and html format

    Returns:
        None
    """
    main_config = open(f"{flow_to_execute}/llmops_config.json")
    model_config = json.load(main_config)

    for obj in model_config["envs"]:
        if obj.get("ENV_NAME") == stage:
            config = obj
            break

    resource_group_name = config["RESOURCE_GROUP_NAME"]
    workspace_name = config["WORKSPACE_NAME"]
    data_mapping_config = f"{flow_to_execute}/configs/mapping_config.json"
    standard_flow_path = config["STANDARD_FLOW_PATH"]
    data_config_path = f"{flow_to_execute}/configs/data_config.json"

    runtime = config["RUNTIME_NAME"]
    eval_flow_path = config["EVALUATION_FLOW_PATH"]
    experiment_name = f"{flow_to_execute}_{stage}"

    eval_flows = eval_flow_path.split(",")

    pf = PFClient(
        DefaultAzureCredential(),
        subscription_id,
        resource_group_name,
        workspace_name
    )

    standard_flow = f"{flow_to_execute}/{standard_flow_path}"
    dataset_name = []
    config_file = open(data_config_path)
    data_config = json.load(config_file)
    for elem in data_config["datasets"]:
        if "DATA_PURPOSE" in elem and "ENV_NAME" in elem:
            if (stage == elem["ENV_NAME"] and
                    data_purpose == elem["DATA_PURPOSE"]):

                data_name = elem["DATASET_NAME"]
                related_data = elem["RELATED_EXP_DATASET"]
                data = pf.ml_client.data.get(name=data_name, label="latest")
                data_id = f"azureml:{data.name}:{data.version}"
                dataset_name.append(
                    {
                        "data_id": data_id,
                        "ref_data": related_data
                    }
                )

    standard_flow_file = f"{standard_flow}/flow.dag.yaml"

    with open(standard_flow_file, "r") as yaml_file:
        yaml_data = yaml.safe_load(yaml_file)

    default_variants = []
    for node_name, node_data in yaml_data.get("node_variants", {}).items():
        node_variant_mapping = {}
        default_variant = node_data["default_variant_id"]
        node_variant_mapping[node_name] = default_variant
        default_variants.append(node_variant_mapping)

    mapping_file = open(data_mapping_config)
    mapping_config = json.load(mapping_file)
    eval_config_node = mapping_config["evaluation"]

    all_eval_df = []
    all_eval_metrics = []

    run_ids = ast.literal_eval(run_id)

    for flow in eval_flows:
        flow = f"{flow_to_execute}/{flow.strip()}"
        dataframes = []
        metrics = []

        flow_name = (flow.split("/")[-1]).strip()
        mapping_node = eval_config_node[flow_name]
        for flow_run in run_ids:
            my_run = pf.runs.get(flow_run)
            run_data_id = my_run.data.replace("azureml:", "")
            run_data_id = run_data_id.split(":")[0]
            for data_item in dataset_name:
                data_n = data_item["data_id"]
                ref_data = data_item["ref_data"]
                if ref_data == run_data_id:
                    data_id = data_n
                    break

            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

            eval_run = Run(
                flow=flow.strip(),
                data=data_id,
                run=my_run,
                column_mapping=mapping_node,
                runtime=runtime,
                # un-comment the resources parameter assignment
                # and update the size of the compute and also
                # comment the runtime parameter assignment to
                # enable automatic runtime.
                # Reference: COMPUTE_RUNTIME
                # resources={"instance_type": "Standard_E4ds_v4"},
                name=f"{experiment_name}_eval_{timestamp}",
                display_name=f"{experiment_name}_eval_{timestamp}",
                tags={"build_id": build_id},
            )
            eval_run._experiment_name = experiment_name
            eval_job = pf.runs.create_or_update(eval_run, stream=True)
            df_result = None

            time.sleep(15)

            if eval_job.status == "Completed" or eval_job.status == "Finished":
                logger.info(eval_job.status)
                df_result = pf.get_details(eval_job)
                metric_variant = pf.get_metrics(eval_job)

                if (
                    my_run.properties.get(
                        "azureml.promptflow.node_variant",
                        None) is not None
                ):
                    variant_id = \
                        my_run.properties["azureml.promptflow.node_variant"]
                    start_index = variant_id.find("{") + 1
                    end_index = variant_id.find("}")
                    variant_value = \
                        variant_id[start_index:end_index].split(".")

                    df_result[variant_value[0]] = variant_value[1]
                    metric_variant[variant_value[0]] = variant_value[1]
                    df_result["dataset"] = data_id
                    metric_variant["dataset"] = data_id

                    for var in default_variants:
                        for key in var.keys():
                            if key == variant_value[0]:
                                pass
                            else:
                                df_result[key] = var[key]
                                metric_variant[key] = var[key]

                dataframes.append(df_result)
                metrics.append(metric_variant)

                logger.info(json.dumps(metrics, indent=4))
                logger.info(df_result.head(10))

            else:
                raise Exception("Sorry, exiting job with failure..")

        if not os.path.exists("./reports"):
            os.makedirs("./reports")

        combined_results_df = pd.concat(dataframes, ignore_index=True)
        combined_metrics_df = pd.DataFrame(metrics)
        combined_results_df["flow_name"] = flow_name
        combined_metrics_df["flow_name"] = flow_name
        combined_results_df["exp_run"] = flow_run
        combined_metrics_df["exp_run"] = flow_run

        combined_results_df.to_csv(f"./reports/{run_data_id}_result.csv")
        combined_metrics_df.to_csv(f"./reports/{run_data_id}_metrics.csv")

        styled_df = combined_results_df.to_html(index=False)

        with open(f"reports/{run_data_id}_result.html", "w") as c_results:
            c_results.write(styled_df)

        html_table_metrics = combined_metrics_df.to_html(index=False)
        with open(f"reports/{run_data_id}_metrics.html", "w") as c_metrics:
            c_metrics.write(html_table_metrics)

        all_eval_df.append(combined_results_df)
        all_eval_metrics.append(combined_metrics_df)

    final_results_df = pd.concat(all_eval_df, ignore_index=True)
    final_metrics_df = pd.concat(all_eval_metrics, ignore_index=True)
    final_results_df["stage"] = stage
    final_results_df["experiment_name"] = experiment_name
    final_results_df["build"] = build_id

    final_results_df.to_csv(f"./reports/{experiment_name}_result.csv")
    final_metrics_df.to_csv(f"./reports/{experiment_name}_metrics.csv")

    styled_df = final_results_df.to_html(index=False)
    with open(f"reports/{experiment_name}_result.html", "w") as f_results:
        f_results.write(styled_df)

    html_table_metrics = final_metrics_df.to_html(index=False)
    with open(f"reports/{experiment_name}_metrics.html", "w") as f_metrics:
        f_metrics.write(html_table_metrics)


def main():
    """
    Run the main evaluation loop by executing evaluation flows.

    Returns:
        None
    """
    parser = argparse.ArgumentParser("prompt_evaluation")
    parser.add_argument(
        "--subscription_id",
        type=str,
        help="Azure subscription id",
        required=True,
    )
    parser.add_argument(
        "--build_id",
        type=str,
        help="Unique identifier for build execution",
        required=True,
    )
    parser.add_argument(
        "--env_name",
        type=str,
        help="environment name(dev, test, prod) for execution/deployment",
        required=True,
    )
    parser.add_argument(
        "--data_purpose",
        type=str,
        help="data identified by purpose",
        required=True
    )
    parser.add_argument(
        "--run_id",
        type=str,
        required=True,
        help="bulk run ids")

    parser.add_argument(
        "--flow_to_execute", type=str, help="flow use case name", required=True
    )

    args = parser.parse_args()

    prepare_and_execute(
        args.subscription_id,
        args.build_id,
        args.env_name,
        args.run_id,
        args.data_purpose,
        args.flow_to_execute,
    )


if __name__ == "__main__":
    main()
