from promptflow import tool
from promptflow.connections import CustomConnection
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import *
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.search.documents.models import *
from langchain.docstore.document import Document
from typing import Mapping
import numpy as np
import json

def performCogSearch(embedValue, embedField, SearchService, SearchKey, indexType, question, indexName, k, searchType,
    returnFields=["id", "content", "sourcefile"] ):
    print("Performing CogSearch")
    print("SearchService: " + SearchService)
    print("indexName: " + indexName)

    searchClient = SearchClient(endpoint=f"https://{SearchService}.search.windows.net",
        index_name=indexName,
        credential=AzureKeyCredential(SearchKey))
    try:
        if indexType == "cogsearchvs":
            if searchType == "similarity":
                r = searchClient.search(  
                    search_text="",  
                    vectors=[Vector(value=embedValue, k=k, fields=embedField)],  
                    select=returnFields,
                    include_total_count=True,
                    top=k
                )
            elif searchType == "hybrid":
                r = searchClient.search(  
                    search_text=question,  
                    vectors=[Vector(value=embedValue, k=k, fields=embedField)],  
                    select=returnFields,
                    include_total_count=True,
                    top=k
                )
            elif searchType == "hybridrerank":
                r = searchClient.search(  
                    search_text=question,  
                    vectors=[Vector(value=embedValue, k=k, fields=embedField)],  
                    select=returnFields,
                    query_type="semantic", 
                    query_language="en-us", 
                    semantic_configuration_name='semanticConfig', 
                    query_caption="extractive", 
                    query_answer="extractive",
                    include_total_count=True,
                    top=k
                )
        elif indexType == "cogsearch":
            #r = searchClient.search(question, filter=None, top=k)
            try:
                r = searchClient.search(question, 
                                    filter=None,
                                    query_type=QueryType.SEMANTIC, 
                                    query_language="en-us", 
                                    query_speller="lexicon", 
                                    semantic_configuration_name="semanticConfig", 
                                    top=k, 
                                    query_caption="extractive|highlight-false")
            except Exception as e:
                 r = searchClient.search(question, 
                                filter=None,
                                query_type=QueryType.SEMANTIC, 
                                query_language="en-us", 
                                query_speller="lexicon", 
                                semantic_configuration_name="default", 
                                top=k, 
                                query_caption="extractive|highlight-false")
        return r
    except Exception as e:
        print(e)

    return None

# The inputs section will change based on the arguments of the tool function, after you save the code
# Adding type to arguments and return value will help the system show the types properly
# Please update the function name/signature per need
@tool
def searchVectorDb(question:str, embeddedQuestion:object, indexType:str, indexNs:str, overrides:list, conn:CustomConnection):
  docs = []
  SearchService = conn.SearchService
  SearchKey = conn.SearchKey
  topK = overrides.get("top") or 5
  vectorField = "contentVector"
  searchType = overrides.get("searchType") or "similarity"
  
  print("searchType: " + searchType)

  if indexType == "cogsearch" or indexType == "cogsearchvs":
      try:
          r = performCogSearch(embeddedQuestion, vectorField, SearchService, SearchKey, indexType, question, indexNs, topK, searchType)
          if r == None:
              docs = [Document(page_content="No Results Found", metadata={"id": "", "source": ""})]
          else :
              docs = [
                  Document(page_content=doc['content'], metadata={"id": doc['id'], "source": doc['sourcefile']})
                  for doc in r
                  ]
      except Exception as e:
          docs = [Document(page_content="No Results Found" + str(e), metadata={"id": "", "source": ""})]
          pass
      return docs
