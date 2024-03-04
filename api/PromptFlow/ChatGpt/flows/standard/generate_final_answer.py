from promptflow import tool
from promptflow.connections import CustomConnection
import uuid
import json
from azure.cosmos import CosmosClient, PartitionKey
from azure.search.documents.models import Vector
import datetime
from langchain.docstore.document import Document
import uuid

def insertMessage(sessionId, type, role, totalTokens, tokens, response, cosmosContainer):
    aiMessage = {
        "id": str(uuid.uuid4()), 
        "type": type, 
        "role": role, 
        "sessionId": sessionId, 
        "tokens": tokens, 
        "timestamp": datetime.datetime.utcnow().isoformat(), 
        "content": response
    }
    cosmosContainer.create_item(body=aiMessage)

# The inputs section will change based on the arguments of the tool function, after you save the code
# Adding type to arguments and return value will help the system show the types properly
# Please update the function name/signature per need
@tool
def generateFinalAnswer(question: str, overrides:list, modifiedAnswer:str, 
    retrievedDocs:object, nextQuestions:str, conn:CustomConnection) -> list:
    sessionId = overrides.get('sessionId')

    try:
        cosmosClient = CosmosClient(url=conn.CosmosEndpoint, credential=conn.CosmosKey)
        cosmosDb = cosmosClient.create_database_if_not_exists(id=conn.CosmosDatabase)
        cosmosKey = PartitionKey(path="/sessionId")
        cosmosContainer = cosmosDb.create_container_if_not_exists(id=conn.CosmosContainer, partition_key=cosmosKey)
    except Exception as e:
        print("Error connecting to CosmosDB: " + str(e))

    thoughtPrompt = ''
    
    # rawDocs=[]
    # for doc in retrievedDocs:
    #     rawDocs.append(doc.page_content)

    rawDocs = [retrievedDocs[i].page_content for i in range(len(retrievedDocs))]

    sources = ''                
    if (modifiedAnswer.find("I don't know") >= 0):
        sources = ''
        nextQuestions = ''

    outputFinalAnswer = {"data_points": rawDocs, "answer": modifiedAnswer, 
            "thoughts": f"<br><br>Prompt:<br>" + thoughtPrompt.replace('\n', '<br>'),
                "sources": sources, "nextQuestions": nextQuestions, "error": ""}
    
    try:
        insertMessage(sessionId, "Message", "Assistant", 0, 0, outputFinalAnswer, cosmosContainer)
    except Exception as e:
        print("Error inserting message: " + str(e))

    results = {}
    results["values"] = []
    results["values"].append({
                "recordId": 0,
                "data": outputFinalAnswer
                })
    return results