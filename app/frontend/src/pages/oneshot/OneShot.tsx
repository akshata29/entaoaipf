import { useRef, useState, useEffect } from "react";
import { Checkbox, ChoiceGroup, IChoiceGroupOption, Panel, DefaultButton, Spinner, TextField, SpinButton, Stack} from "@fluentui/react";
import { ShieldLockRegular } from "@fluentui/react-icons";

import styles from "./OneShot.module.css";
import { Dropdown, IDropdownStyles, IDropdownOption } from '@fluentui/react/lib/Dropdown';

import { askApi, Approaches, AskResponse, AskRequest, refreshIndex, getSpeechApi, 
    refreshQuestions, getUserInfo, SearchTypes } from "../../api";
import { Answer, AnswerError } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { Label } from '@fluentui/react/lib/Label';
import { ExampleList, ExampleModel } from "../../components/Example";
import { SettingsButton } from "../../components/SettingsButton/SettingsButton";
import { QuestionListButton } from "../../components/QuestionListButton/QuestionListButton";
import { ClearChatButton } from "../../components/ClearChatButton";
import { Pivot, PivotItem } from '@fluentui/react';
import { IStackTokens, IStackItemStyles } from '@fluentui/react/lib/Stack';
import { DetailsList, DetailsListLayoutMode, SelectionMode, ConstrainMode } from '@fluentui/react/lib/DetailsList';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

var audio = new Audio();

const OneShot = () => {
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [isQuestionPanelOpen, setIsQuestionPanelOpen] = useState(false);
    const [approach, setApproach] = useState<Approaches>(Approaches.RetrieveThenRead);
    const [searchTypeOptions, setSearchTypeOptions] = useState<SearchTypes>(SearchTypes.Similarity);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [promptTemplatePrefix, setPromptTemplatePrefix] = useState<string>("");
    const [promptTemplateSuffix, setPromptTemplateSuffix] = useState<string>("");
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [temperature, setTemperature] = useState<number>(0);
    const [tokenLength, setTokenLength] = useState<number>(1000);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(true);
    const [useAutoSpeakAnswers, setUseAutoSpeakAnswers] = useState<boolean>(false);

    const [options, setOptions] = useState<any>([])
    const [selectedItem, setSelectedItem] = useState<IDropdownOption>();
    const dropdownStyles: Partial<IDropdownStyles> = { dropdown: { width: 300 } };

    const lastQuestionRef = useRef<string>("");

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();
    //const [answer, setAnswer] = useState<AskResponse>();
    const [answer, setAnswer] = useState<[AskResponse, string | null]>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);
    const [selectedChain, setSelectedChain] = useState<IDropdownOption>();

    //const [selectedIndex, setSelectedIndex] = useState<IDropdownOption>();
    const [selectedIndex, setSelectedIndex] = useState<string>();
    const [indexMapping, setIndexMapping] = useState<{ key: string; iType: string;  summary:string; qa:string; chunkSize:string; chunkOverlap:string; promptType:string}[]>();
    const [exampleList, setExampleList] = useState<ExampleModel[]>([{text:'', value: ''}]);
    const [summary, setSummary] = useState<string>();
    const [qa, setQa] = useState<string>('');
    const [exampleLoading, setExampleLoading] = useState(false)
    const [chainTypeOptions, setChainTypeOptions] = useState<any>([])

    const [filteredOptions, setFilteredOptions] = useState<any>([])
    const [selectedindexTypeItem, setSelectedindexTypeItem] = useState<IDropdownOption>();
    const [selectedIndexes, setSelectedIndexes] = useState<{ indexNs: string; indexName: any; returnDirect: string; }[]>([]);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

    const [selectedEmbeddingItem, setSelectedEmbeddingItem] = useState<IDropdownOption>();
    const [questionList, setQuestionList] = useState<any[]>();
    const [selectedChunkSize, setSelectedChunkSize] = useState<string>()
    const [selectedChunkOverlap, setSelectedChunkOverlap] = useState<string>()
    const [selectedPromptType, setSelectedPromptType] = useState<string>()
    const [selectedDeploymentType, setSelectedDeploymentType] = useState<IDropdownOption>();
    const [selectedPromptTypeItem, setSelectedPromptTypeItem] = useState<IDropdownOption>();
    const [showAuthMessage, setShowAuthMessage] = useState<boolean>(false);


    const classNames = mergeStyleSets({
        header: {
          margin: 0,
        },
        row: {
          flex: '0 0 auto',
        },
        focusZone: {
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        },
        selectionZone: {
          height: '100%',
          overflow: 'hidden',
        },
      });

    const focusZoneProps = {
        className: classNames.focusZone,
        'data-is-scrollable': 'true',
    } as React.HTMLAttributes<HTMLElement>;

    const embeddingOptions = [
        {
          key: 'azureopenai',
          text: 'Azure Open AI'
        },
        {
          key: 'openai',
          text: 'Open AI'
        }
        // {
        //   key: 'local',
        //   text: 'Local Embedding'
        // }
    ]

    const promptTypeOptions = [
        {
          key: 'generic',
          text: 'generic'
        },
        {
          key: 'medical',
          text: 'medical'
        },
        {
          key: 'financial',
          text: 'financial'
        },
        {
            key: 'financialtable',
            text: 'financialtable'
        },
        {
            key: 'prospectus',
            text: 'prospectus'
        },
        {
            key: 'productdocmd',
            text: 'productdocmd'
        },
        {
          key: 'insurance',
          text: 'insurance'
        }
    ]

    const deploymentTypeOptions = [
        {
          key: 'gpt35',
          text: 'GPT 3.5 Turbo'
        },
        {
          key: 'gpt3516k',
          text: 'GPT 3.5 Turbo - 16k'
        }
    ]

    const indexTypeOptions = [
        {
          key: 'pinecone',
          text: 'Pinecone'
        },
        {
          key: 'redis',
          text: 'Redis Stack'
        }
        // {
        //   key: 'chroma',
        //   text: 'Chroma'
        // }
    ]

    const questionListColumn = [
        {
          key: 'question',
          name: 'Question',
          fieldName: 'question',
          minWidth: 100, maxWidth: 200, isResizable: true
        }
    ]

    const chainType = [
        { key: 'stuff', text: 'Stuff'},
        { key: 'map_rerank', text: 'Map ReRank' },
        { key: 'map_reduce', text: 'Map Reduce' },
        { key: 'refine', text: 'Refine'},
    ]

    const getUserInfoList = async () => {
        const userInfoList = await getUserInfo();
        if (userInfoList.length === 0 && window.location.hostname !== "localhost") {
            setShowAuthMessage(true);
        }
        else {
            setShowAuthMessage(false);
        }
    }

    const refreshFilteredBlob = async(selectedIndex : string) => {
        const files = []
        const indexType = []
    
        //const blobs = containerClient.listBlobsFlat(listOptions)
        const blobs = await refreshIndex()       
        for (const blob of blobs.values) {
          if (blob.embedded == "true" && blob.indexType == selectedIndex)
          {
            files.push({
                text: blob.indexName,
                key: blob.namespace
            })
            indexType.push({
                    key:blob.namespace,
                    iType:blob.indexType,
                    summary:blob.summary,
                    qa:blob.qa,
                    chunkSize:blob.chunkSize,
                    chunkOverlap:blob.chunkOverlap,
                    promptType:blob.promptType
            })
          }
        }
        var uniqFiles = files.filter((v,i,a)=>a.findIndex(v2=>(v2.key===v.key))===i)
        setFilteredOptions(uniqFiles)
    }

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const request: AskRequest = {
                question,
                approach,
                overrides: {
                    promptTemplate: promptTemplate.length === 0 ? undefined : promptTemplate,
                    promptTemplatePrefix: promptTemplatePrefix.length === 0 ? undefined : promptTemplatePrefix,
                    promptTemplateSuffix: promptTemplateSuffix.length === 0 ? undefined : promptTemplateSuffix,
                    top: retrieveCount,
                    temperature: temperature,
                    semanticRanker: useSemanticRanker,
                    semanticCaptions: useSemanticCaptions,
                    chainType: String(selectedChain?.key),
                    tokenLength: tokenLength,
                    suggestFollowupQuestions: useSuggestFollowupQuestions,
                    autoSpeakAnswers: useAutoSpeakAnswers,
                    embeddingModelType: String(selectedEmbeddingItem?.key),
                    deploymentType: String(selectedDeploymentType?.key),
                    searchType: searchTypeOptions,
                }
            };
            const result = await askApi(request, String(selectedItem?.key), String(selectedIndex), 'stuff');
            //setAnswer(result);
            setAnswer([result, null]);
            if(useAutoSpeakAnswers) {
                const speechUrl = await getSpeechApi(result.answer);
                setAnswer([result, speechUrl]);
                startSynthesis("Answer", speechUrl);
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const startSynthesis = async (answerType: string, url: string | null) => {
        if(isSpeaking) {
            audio.pause();
            setIsSpeaking(false);
        }

        if(url === null) {
            let speechAnswer;
            if (answerType == "Answer")
                speechAnswer = answer && answer[0].answer;

            const speechUrl = await getSpeechApi(speechAnswer || '');
            if (speechUrl === null) {
                return;
            }
            audio = new Audio(speechUrl);
            audio.play();
            setIsSpeaking(true);
            audio.addEventListener('ended', () => {
                setIsSpeaking(false);
            });

        } else {
            audio = new Audio(url);
            audio.play();
            setIsSpeaking(true);
            audio.addEventListener('ended', () => {
                setIsSpeaking(false);
            });    
        }
    };

    const onEmbeddingChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item?.key === "openai") {
            setSelectedDeploymentType(deploymentTypeOptions[0]);
        }
        setSelectedEmbeddingItem(item);
    };

    const onDeploymentTypeChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedDeploymentType(item);
    };

    const stopSynthesis = () => {
        audio.pause();
        setIsSpeaking(false);
    };

    const onEnableAutoSpeakAnswersChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseAutoSpeakAnswers(!!checked);
    };

    const onPromptTemplateChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setPromptTemplate(newValue || "");
    };

    const onUseSuggestFollowupQuestionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSuggestFollowupQuestions(!!checked);
    };

    const onRetrieveCountChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setRetrieveCount(parseInt(newValue || "3"));
    };

    const onTemperatureChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setTemperature(parseInt(newValue || "0.3"));
    };

    const onTokenLengthChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setTokenLength(parseInt(newValue || "1000"));
    };

    const onSearchTypeChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, option?: IChoiceGroupOption) => {
        setSearchTypeOptions((option?.key as SearchTypes) || SearchTypes.Similarity);
    };

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const onShowCitation = (citation: string) => {
        if (citation.indexOf('http') > -1 || citation.indexOf('https') > -1) {
            window.open(citation.replace('/content/', ''), '_blank');
        } else {
            if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab) {
                setActiveAnalysisPanelTab(undefined);
            } else {
                setActiveCitation(citation);
                setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
            }
        }
    };

    const onToggleTab = (tab: AnalysisPanelTabs) => {
        if (activeAnalysisPanelTab === tab) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }
    };

    const onPromptTypeChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedPromptTypeItem(item);
        updatePrompt(String(item?.key));
    };

    const refreshBlob = async () => {
        const files = []
        const indexType = []
    
        //const blobs = containerClient.listBlobsFlat(listOptions)
        const blobs = await refreshIndex()
        for (const blob of blobs.values) {
          if (blob.embedded == "true")
          {
            files.push({
                text: blob.indexName,
                key: blob.namespace
            })
            indexType.push({
                    key:blob.namespace,
                    iType:blob.indexType,
                    summary:blob.summary,
                    qa:blob.qa == null ? '' : blob.qa,
                    chunkSize:blob.chunkSize,
                    chunkOverlap:blob.chunkOverlap,
                    promptType:blob.promptType
            })
          }
        }
        var uniqFiles = files.filter((v,i,a)=>a.findIndex(v2=>(v2.key===v.key))===i)
        setOptions(uniqFiles)
        setSelectedItem(uniqFiles[0])

        const defaultKey = uniqFiles[0].key
       
        var uniqIndexType = indexType.filter((v,i,a)=>a.findIndex(v2=>(v2.key===v.key))===i)

        for (const item of uniqIndexType) {
            if (item.key == defaultKey) {
                setSelectedIndex(item.iType)
                setSummary(item.summary)
                setQa(item.qa)
                setSelectedChunkOverlap(item.chunkOverlap)
                setSelectedChunkSize(item.chunkSize)
                setSelectedPromptType(item.promptType)
                setSelectedPromptTypeItem(promptTypeOptions.find(x => x.key === item.promptType))
                updatePrompt(item.promptType)

                if (Number(item.chunkSize) > 4000) {
                    setSelectedDeploymentType(deploymentTypeOptions[1])
                } else {
                    setSelectedDeploymentType(deploymentTypeOptions[0])
                }

                const sampleQuestion = []
                const  questionList = item.qa.split("\\n")
                for (const item of questionList) {
                    if ((item != '')) {
                        sampleQuestion.push({
                            text: item.replace(/^\d+\.\s*/, '').replace('<', '').replace('>', ''),
                            value: item.replace(/^\d+\.\s*/, '').replace('<', '').replace('>', ''),
                        })
                    } 
                }
                const generatedExamples: ExampleModel[] = sampleQuestion
                setExampleList(generatedExamples)
                setExampleLoading(false)
            }
        }
        setIndexMapping(uniqIndexType)
    }

    const clickRefreshQuestions = async () => {
        setIsQuestionPanelOpen(!isQuestionPanelOpen)
        await refreshQuestionList()
    }

    const refreshQuestionList = async () => {
        let questionList
        if (selectedIndex == undefined) {
            questionList = await refreshQuestions(selectedIndexes[0].indexName, selectedIndexes[0].indexNs)
        }
        else 
            questionList = await refreshQuestions(String(selectedIndex), String(selectedItem?.key))
        
        const sampleQuestionList = []
        for (const question of questionList.values) {
            sampleQuestionList.push({
                question: question.question,
            });    
        }
        setQuestionList(sampleQuestionList)
    }

    const updatePrompt = (promptType: string) => {
        const genericPrompt = `Given the following extracted parts of a long document and a question, create a final answer. 
        If you don't know the answer, just say that you don't know. Don't try to make up an answer. 
        If the answer is not contained within the text below, say \"I don't know\".

        {summaries}
        Question: {question}
        `

        const medicalPrompt = `You are an AI assistant tasked with answering questions and summarizing information from medical records documents. 
        Your answer should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
        Please generate a concise and comprehensive information that includes details such as patient information, medical history, 
        allergies, chronic conditions, previous surgeries, prescribed medications, and upcoming appointments. 
        Ensure that it is easy to understand for healthcare professionals and provides an accurate representation of the patient's medical history 
        and current health status. 
        
        Begin with a brief introduction of the patient, followed by the main points of their medical records.
        Please remember to use clear language and maintain the integrity of the original information without missing any important details
        {summaries}
        Question: {question}
        `

        const financialPrompt = `You are an AI assistant tasked with answering questions and summarizing information from 
        earning call transcripts, annual reports, SEC filings and financial statements.
        Your answer should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
        Please generate a concise and comprehensive information that includes details such as reporting year and amount in millions.
        Ensure that it is easy to understand for business professionals and provides an accurate representation of the financial statement history. 
        
        Please remember to use clear language and maintain the integrity of the original information without missing any important details

        QUESTION: {question}
        =========
        {summaries}
        =========
        `

        const financialTablePrompt = `You are an AI assistant tasked with answering questions and summarizing information from 
        financial statements like income statement, cashflow and balance sheets. 
        Additionally you may also be asked to answer questions about financial ratios and other financial metrics.
        The data that you are presented will be in table format or structure.
        Your answer should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
        Please generate a concise and comprehensive information that includes details such as reporting year and amount in millions.
        Ensure that it is easy to understand for business professionals and provides an accurate representation of the financial statement history. 
        
        Please remember to use clear language and maintain the integrity of the original information without missing any important details

        QUESTION: {question}
        =========
        {summaries}
        =========
        `

        const prospectusPrompt = `"""You are an AI assistant tasked with summarizing documents from large documents that contains information about Initial Public Offerings. 
        IPO document contains sections with information about the company, its business, strategies, risk, management structure, financial, and other information.
        Your summary should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
        Please remember to use clear language and maintain the integrity of the original information without missing any important details:
        QUESTION: {question}
        =========
        {summaries}
        =========

        """`

        const productDocMdPrompt = `"""You are an AI assistant tasked with answering questions and summarizing information for 
        product or service from documentations and knowledge base.
        Your answer should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
        Please generate a concise and comprehensive information that includes details about the product or service.
        Please remember to use clear language and maintain the integrity of the original information without missing any important details
        QUESTION: {question}
        =========
        {summaries}
        =========

        """`

        if (promptType == "generic") {
            setPromptTemplate(genericPrompt)
        }
        else if (promptType == "medical") {
            setPromptTemplate(medicalPrompt)
        } else if (promptType == "financial") {
            setPromptTemplate(financialPrompt)
        } else if (promptType == "financialtable") {
            setPromptTemplate(financialTablePrompt)
        } else if (promptType == "prospectus") {
            setPromptTemplate(prospectusPrompt)
        } else if (promptType == "productdocmd") {
            setPromptTemplate(productDocMdPrompt)
        } else if (promptType == "custom") {
            setPromptTemplate("")
        }
    }

    const onChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedItem(item);
        setAnswer(undefined)
        const defaultKey = item?.key
        indexMapping?.findIndex((item) => {
            if (item.key == defaultKey) {
                setSelectedIndex(item.iType)
                setSelectedChunkSize(item.chunkSize)
                setSelectedChunkOverlap(item.chunkOverlap)
                setSelectedPromptType(item.promptType)
                setSelectedPromptTypeItem(promptTypeOptions.find(x => x.key === item.promptType))
                setSummary(item.summary)
                setQa(item.qa)
                updatePrompt(item.promptType)

                if (Number(item.chunkSize) > 4000) {
                    setSelectedDeploymentType(deploymentTypeOptions[1])
                } else {
                    setSelectedDeploymentType(deploymentTypeOptions[0])
                }
                const sampleQuestion = []

                const  questionList = item.qa.split("\\n")
                for (const item of questionList) {
                    if ((item != '')) {
                        sampleQuestion.push({
                            text: item.replace(/^\d+\.\s*/, '').replace('<', '').replace('>', ''),  //item.replace(/[0-9]./g, ''),
                            value: item.replace(/^\d+\.\s*/, '').replace('<', '').replace('>', '') //item.replace(/[0-9]./g, ''),
                        })
                    } 
                }
                const generatedExamples: ExampleModel[] = sampleQuestion
                setExampleList(generatedExamples)
                setExampleLoading(false)
            }
        })
    };

    const onChainChange = (event: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedChain(item);
    };

    useEffect(() => {
        if (window.location.hostname != "localhost") {
            getUserInfoList();
            setShowAuthMessage(true)
        } else
            setShowAuthMessage(false)

        refreshBlob()
        setChainTypeOptions(chainType)
        setSelectedChain(chainType[0])
        setSelectedindexTypeItem(indexTypeOptions[0])
        refreshFilteredBlob(indexTypeOptions[0].key)
        setSelectedEmbeddingItem(embeddingOptions[0])
        setSelectedDeploymentType(deploymentTypeOptions[0])
    }, [])

    const searchTypes: IChoiceGroupOption[] = [
        {
            key: SearchTypes.Similarity,
            text: "Similarity"
        },
        {
            key: SearchTypes.Hybrid,
            text: "Hybrid"
        },
        {
            key: SearchTypes.HybridReRank,
            text: "Hybrid with ReRank"
        }
    ];

    const onQuestionClicked = (questionFromList: any) => {
        makeApiRequest(questionFromList.question);
    }
    
    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setAnswer(undefined);
    };

    return (
        <div className={styles.root}>
            {showAuthMessage ? (
                <Stack className={styles.chatEmptyState}>
                    <ShieldLockRegular className={styles.chatIcon} style={{color: 'darkorange', height: "200px", width: "200px"}}/>
                    <h1 className={styles.chatEmptyStateTitle}>Authentication Not Configured</h1>
                    <h2 className={styles.chatEmptyStateSubtitle}>
                        This app does not have authentication configured. Please add an identity provider by finding your app in the 
                        <a href="https://portal.azure.com/" target="_blank"> Azure Portal </a>
                        and following 
                         <a href="https://learn.microsoft.com/en-us/azure/app-service/scenario-secure-app-authentication-app-service#3-configure-authentication-and-authorization" target="_blank"> these instructions</a>.
                    </h2>
                    <h2 className={styles.chatEmptyStateSubtitle} style={{fontSize: "20px"}}><strong>Authentication configuration takes a few minutes to apply. </strong></h2>
                    <h2 className={styles.chatEmptyStateSubtitle} style={{fontSize: "20px"}}><strong>If you deployed in the last 10 minutes, please wait and reload the page after 10 minutes.</strong></h2>
                </Stack>
            ) : (
            <div className={styles.oneshotContainer}>
            <Pivot aria-label="QA">
                    <PivotItem
                        headerText="QA"
                        headerButtonProps={{
                        'data-order': 1,
                        }}
                    >
                            <div className={styles.oneshotTopSection}>
                                <div className={styles.commandsContainer}>
                                    <ClearChatButton className={styles.settingsButton}  text="Clear chat" onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
                                    <SettingsButton className={styles.settingsButton} onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)} />
                                    <QuestionListButton className={styles.settingsButton} onClick={() => clickRefreshQuestions()} />
                                    <div className={styles.settingsButton}>{selectedItem ? 
                                            "Document Name : "  + selectedItem.text : undefined}</div>
                                </div>
                                <h1 className={styles.oneshotTitle}>Ask your data</h1>
                                <div className={styles.example}>
                                    <p className={styles.exampleText}><b>Document Summary</b> : {summary}</p>
                                </div>
                                <br/>
                                <div className={styles.oneshotQuestionInput}>
                                    <QuestionInput
                                        placeholder="Ask me anything"
                                        updateQuestion={lastQuestionRef.current}
                                        disabled={isLoading}
                                        onSend={question => makeApiRequest(question)}
                                    />
                                </div>
                                {!answer && (<h4 className={styles.chatEmptyStateSubtitle}>Ask anything or try from following example</h4>)}
                                {exampleLoading ? <div><span>Please wait, Generating Sample Question</span><Spinner/></div> : null}
                                <ExampleList onExampleClicked={onExampleClicked}
                                EXAMPLES={
                                    exampleList
                                } />
                            </div>
                            <div className={styles.oneshotBottomSection}>
                                {isLoading && <Spinner label="Generating answer" />}
                                {!isLoading && answer && !error && (
                                    <div>
                                        <div className={styles.oneshotAnswerContainer}>
                                            <Stack horizontal horizontalAlign="space-between">
                                                <Answer
                                                    answer={answer[0]}
                                                    isSpeaking = {isSpeaking}
                                                    onCitationClicked={x => onShowCitation(x)}
                                                    onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab)}
                                                    onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab)}
                                                    onFollowupQuestionClicked={q => makeApiRequest(q)}
                                                    showFollowupQuestions={useSuggestFollowupQuestions}
                                                    onSpeechSynthesisClicked={() => isSpeaking? stopSynthesis(): startSynthesis("Answer", answer[1])}
                                                />
                                            </Stack>                               
                                        </div>
                                    </div>
                                )}
                                {error ? (
                                    <div className={styles.oneshotAnswerContainer}>
                                        <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                    </div>
                                ) : null}
                                {activeAnalysisPanelTab && answer && (
                                    <AnalysisPanel
                                        className={styles.oneshotAnalysisPanel}
                                        activeCitation={activeCitation}
                                        onActiveTabChanged={x => onToggleTab(x)}
                                        citationHeight="600px"
                                        //answer={answer}
                                        answer={answer[0]}
                                        activeTab={activeAnalysisPanelTab}
                                    />
                                )}
                            </div>

                            <Panel
                                headerText="List of Questions for KB"
                                isOpen={isQuestionPanelOpen}
                                isBlocking={false}
                                onDismiss={() => setIsQuestionPanelOpen(false)}
                                closeButtonAriaLabel="Close"
                                onRenderFooterContent={() => <DefaultButton onClick={() => setIsQuestionPanelOpen(false)}>Close</DefaultButton>}
                                isFooterAtBottom={true}
                            >
                                <br/>
                                <Label>Click the question from the KB to get the cached answer</Label>
                                <div>
                                    <DetailsList
                                        compact={true}
                                        items={questionList || []}
                                        columns={questionListColumn}
                                        selectionMode={SelectionMode.none}
                                        getKey={(item: any) => item.key}
                                        setKey="none"
                                        constrainMode={ConstrainMode.unconstrained}
                                        onActiveItemChanged={(item:any) => onQuestionClicked(item)}
                                        focusZoneProps={focusZoneProps}
                                        layoutMode={DetailsListLayoutMode.justified}
                                        ariaLabelForSelectionColumn="Toggle selection"
                                        checkButtonAriaLabel="select row"
                                    />
                                </div>
                                <br/>
                                <DefaultButton onClick={refreshQuestionList}>Refresh Question</DefaultButton>
                            </Panel>

                            <Panel
                                headerText="Configure answer generation"
                                isOpen={isConfigPanelOpen}
                                isBlocking={false}
                                onDismiss={() => setIsConfigPanelOpen(false)}
                                closeButtonAriaLabel="Close"
                                onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>Close</DefaultButton>}
                                isFooterAtBottom={true}
                            >
                                <br/>
                                <div>
                                    <DefaultButton onClick={refreshBlob}>Refresh Docs</DefaultButton>
                                    <Dropdown
                                        selectedKey={selectedItem ? selectedItem.key : undefined}
                                        // eslint-disable-next-line react/jsx-no-bind
                                        onChange={onChange}
                                        placeholder="Select an PDF"
                                        options={options}
                                        styles={dropdownStyles}
                                    />
                                    <Label className={styles.commandsContainer}>Index Type : {selectedIndex}</Label>
                                    <Label className={styles.commandsContainer}>Chunk Size : {selectedChunkSize} / Chunk Overlap : {selectedChunkOverlap}</Label>
                                </div>
                                <div>
                                    <Label>LLM Model</Label>
                                    <Dropdown
                                        selectedKey={selectedEmbeddingItem ? selectedEmbeddingItem.key : undefined}
                                        onChange={onEmbeddingChange}
                                        placeholder="Select an LLM Model"
                                        options={embeddingOptions}
                                        disabled={false}
                                        styles={dropdownStyles}
                                    />
                                </div>
                                <div>
                                    <Label>Deployment Type</Label>
                                    <Dropdown
                                            selectedKey={selectedDeploymentType ? selectedDeploymentType.key : undefined}
                                            onChange={onDeploymentTypeChange}
                                            placeholder="Select an Deployment Type"
                                            options={deploymentTypeOptions}
                                            disabled={((selectedEmbeddingItem?.key == "openai" ? true : false) || (Number(selectedChunkSize) > 4000 ? true : false))}
                                            styles={dropdownStyles}
                                    />
                                </div>
                                <div>
                                    <Label>Prompt Type</Label>
                                    <Dropdown
                                            selectedKey={selectedPromptTypeItem ? selectedPromptTypeItem.key : undefined}
                                            onChange={onPromptTypeChange}
                                            placeholder="Prompt Type"
                                            options={promptTypeOptions}
                                            disabled={false}
                                            styles={dropdownStyles}
                                    />
                                    <TextField
                                        className={styles.oneshotSettingsSeparator}
                                        value={promptTemplate}
                                        label="Override prompt template"
                                        multiline
                                        autoAdjustHeight
                                        onChange={onPromptTemplateChange}
                                    />
                                </div>
                                <ChoiceGroup
                                    className={styles.oneshotSettingsSeparator}
                                    label="Search Type"
                                    options={searchTypes}
                                    defaultSelectedKey={searchTypeOptions}
                                    onChange={onSearchTypeChange}
                                />

                                <SpinButton
                                    className={styles.oneshotSettingsSeparator}
                                    label="Document to Retrieve from search:"
                                    min={1}
                                    max={7}
                                    defaultValue={retrieveCount.toString()}
                                    onChange={onRetrieveCountChange}
                                />
                                <SpinButton
                                    className={styles.oneshotSettingsSeparator}
                                    label="Set the Temperature:"
                                    min={0.0}
                                    max={1.0}
                                    defaultValue={temperature.toString()}
                                    onChange={onTemperatureChange}
                                />
                                <SpinButton
                                    className={styles.oneshotSettingsSeparator}
                                    label="Max Length (Tokens):"
                                    min={0}
                                    max={4000}
                                    defaultValue={tokenLength.toString()}
                                    onChange={onTokenLengthChange}
                                />
                                <Dropdown 
                                    label="Chain Type"
                                    onChange={onChainChange}
                                    selectedKey={selectedChain ? selectedChain.key : 'stuff'}
                                    options={chainTypeOptions}
                                    defaultSelectedKey={'stuff'}
                                    styles={dropdownStyles}
                                />
                                <Checkbox
                                    className={styles.chatSettingsSeparator}
                                    checked={useSuggestFollowupQuestions}
                                    label="Suggest follow-up questions"
                                    onChange={onUseSuggestFollowupQuestionsChange}
                                />
                                <Checkbox
                                    className={styles.chatSettingsSeparator}
                                    checked={useAutoSpeakAnswers}
                                    label="Automatically speak answers"
                                    onChange={onEnableAutoSpeakAnswersChange}
                                />
                                <br/>
                                {/* <DefaultButton onClick={() => refreshSummary('summary')}>Regenerate Summary</DefaultButton>
                                <DefaultButton onClick={() => refreshSummary('qa')}>Regenerate Qa</DefaultButton> */}
                            </Panel>
                    </PivotItem>
                </Pivot>
            </div>
            )}
        </div>
    );
};

export default OneShot;

