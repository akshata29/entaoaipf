from promptflow import tool
import tiktoken
from promptflow.connections import CustomConnection
from typing import Any, Sequence
import openai
from azure.cosmos import CosmosClient, PartitionKey
import datetime
import uuid
import json

MODELS_2_TOKEN_LIMITS = {
    "gpt-35-turbo": 4000,
    "gpt-3.5-turbo": 4000,
    "gpt-35-turbo-16k": 16000,
    "gpt-3.5-turbo-16k": 16000,
    "gpt-4": 8100,
    "gpt-4-32k": 32000
}

AOAI_2_OAI = {
    "gpt-35-turbo": "gpt-3.5-turbo",
    "gpt-35-turbo-16k": "gpt-3.5-turbo-16k"
}

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

def getOaiChatModel(aoaimodel: str) -> str:
    message = "Expected Azure OpenAI ChatGPT model name"
    if aoaimodel == "" or aoaimodel is None:
        raise ValueError(message)
    if aoaimodel not in AOAI_2_OAI and aoaimodel not in MODELS_2_TOKEN_LIMITS:
        raise ValueError(message)
    return AOAI_2_OAI.get(aoaimodel) or aoaimodel
    
def getTokenLimit(modelId: str) -> int:
    if modelId not in MODELS_2_TOKEN_LIMITS:
        raise ValueError("Expected model gpt-35-turbo and above")
    return MODELS_2_TOKEN_LIMITS.get(modelId)

def numTokenFromMessages(message: dict[str, str], model: str) -> int:
    """
    Calculate the number of tokens required to encode a message.
    Args:
        message (dict): The message to encode, represented as a dictionary.
        model (str): The name of the model to use for encoding.
    Returns:
        int: The total number of tokens required to encode the message.
    Example:
        message = {'role': 'user', 'content': 'Hello, how are you?'}
        model = 'gpt-3.5-turbo'
        numTokenFromMessages(message, model)
        output: 11
    """
    encoding = tiktoken.encoding_for_model(getOaiChatModel(model))
    num_tokens = 2  # For "role" and "content" keys
    for key, value in message.items():
        num_tokens += len(encoding.encode(value))
    return num_tokens

def getMessagesFromHistory(systemPrompt: str, modelId: str, history: Sequence[dict[str, str]], 
                           userConv: str, fewShots = [], maxTokens: int = 4096):
        messages = []
        messages.append({'role': 'system', 'content': systemPrompt})
        tokenLength = numTokenFromMessages(messages[-1], modelId)

        # Add examples to show the chat what responses we want. It will try to mimic any responses and make sure they match the rules laid out in the system message.
        for shot in fewShots:
            messages.insert(1, {'role': shot.get('role'), 'content': shot.get('content')})

        userContent = userConv
        appendIndex = len(fewShots) + 1

        messages.insert(appendIndex, {'role': "user", 'content': userContent})

        for h in reversed(history[:-1]):
            if h.get("bot"):
                messages.insert(appendIndex, {'role': "assistant", 'content': h.get('bot')})
            messages.insert(appendIndex, {'role': "user", 'content': h.get('user')})
            tokenLength += numTokenFromMessages(messages[appendIndex], modelId)
            if tokenLength > maxTokens:
                break

        return messages

# The inputs section will change based on the arguments of the tool function, after you save the code
# Adding type to arguments and return value will help the system show the types properly
# Please update the function name/signature per need
@tool
def extractQuestionFromHistory(overrides: list, conn:CustomConnection, history: object):
  embeddingModelType = overrides.get('embeddingModelType') or 'azureopenai'
  tokenLength = overrides.get('tokenLength') or 500
  deploymentType = overrides.get('deploymentType') or 'gpt35'
  firstSession = overrides.get('firstSession') or False
  sessionId = overrides.get('sessionId')

  try:
    cosmosClient = CosmosClient(url=conn.CosmosEndpoint, credential=conn.CosmosKey)
    cosmosDb = cosmosClient.create_database_if_not_exists(id=conn.CosmosDatabase)
    cosmosKey = PartitionKey(path="/sessionId")
    cosmosContainer = cosmosDb.create_container_if_not_exists(id=conn.CosmosContainer, partition_key=cosmosKey)
  except Exception as e:
    print("Error connecting to CosmosDB: " + str(e))

  try:
    if firstSession:
        sessionInfo = overrides.get('session') or ''
        session = json.loads(sessionInfo)
        cosmosContainer.upsert_item(session)
        print(session)
  except Exception as e:
    print("Error inserting session into CosmosDB: " + str(e))

  lastQuestion = history[-1]["user"]
  insertMessage(sessionId, "Message", "User", 0, 0, lastQuestion, cosmosContainer)