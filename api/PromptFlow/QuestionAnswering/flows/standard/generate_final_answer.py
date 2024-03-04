from promptflow import tool
from promptflow.connections import CustomConnection
import uuid
import json
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import *
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.search.documents.models import QueryType
from azure.search.documents.models import Vector

def indexDocs(SearchService, SearchKey, indexName, docs):
    print("Total docs: " + str(len(docs)))
    searchClient = SearchClient(endpoint=f"https://{SearchService}.search.windows.net/",
                                    index_name=indexName,
                                    credential=AzureKeyCredential(SearchKey))
    i = 0
    batch = []
    for s in docs:
        batch.append(s)
        i += 1
        if i % 1000 == 0:
            results = searchClient.upload_documents(documents=batch)
            succeeded = sum([1 for r in results if r.succeeded])
            print(f"\tIndexed {len(results)} sections, {succeeded} succeeded")
            batch = []

    if len(batch) > 0:
        results = searchClient.upload_documents(documents=batch)
        succeeded = sum([1 for r in results if r.succeeded])
        print(f"\tIndexed {len(results)} sections, {succeeded} succeeded")

# The inputs section will change based on the arguments of the tool function, after you save the code
# Adding type to arguments and return value will help the system show the types properly
# Please update the function name/signature per need
@tool
def generateFollowupQuestions(retrievedDocs: list, question: str, embeddedQuestion:object, overrides:list, modifiedAnswer:str, 
    existingAnswer:int, jsonAnswer:list, indexType:str, indexNs:str, nextQuestions:str, conn:CustomConnection) -> list:

  if existingAnswer == 1:
    results = {}
    results["values"] = []
    results["values"].append({
                "recordId": 0,
                "data": jsonAnswer
                })
    return results
  else:
    kbData = []
    kbId = str(uuid.uuid4())
    overrideChain = overrides.get("chainType") or 'stuff'

    rawDocs=[]
    for doc in retrievedDocs:
        rawDocs.append(doc.page_content)

    thoughtPrompt = ''
    
    sources = ''                
    if (modifiedAnswer.find("I don't know") >= 0):
        sources = ''
        nextQuestions = ''

    outputFinalAnswer = {"data_points": rawDocs, "answer": modifiedAnswer, 
            "thoughts": f"<br><br>Prompt:<br>" + thoughtPrompt.replace('\n', '<br>'),
                "sources": sources, "nextQuestions": nextQuestions, "error": ""}
    
    try:
        kbData.append({
            "id": kbId,
            "question": question,
            "indexType": indexType,
            "indexName": indexNs,
            "vectorQuestion": embeddedQuestion,
            "answer": json.dumps(outputFinalAnswer),
        })

        SearchService = conn.SearchService
        SearchKey = conn.SearchKey
        KbIndexName = conn.KbIndexName
        indexDocs(SearchService, SearchKey, KbIndexName, kbData)
    except Exception as e:
        print("Error in KB Indexing: " + str(e))
        pass

    results = {}
    results["values"] = []
    results["values"].append({
                "recordId": 0,
                "data": outputFinalAnswer
                })
    return results