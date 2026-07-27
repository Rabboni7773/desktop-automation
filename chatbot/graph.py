from langgraph.graph import START, StateGraph, END
from langgraph.graph.message import add_messages, RemoveMessage
from langgraph.checkpoint.sqlite import SqliteSaver
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage
import sqlite3
import json
from dotenv import load_dotenv
from typing import TypedDict, Annotated


load_dotenv()

# def all_threads():
#     all_threads = set()
#     for thread in memory.list(None):
#         all_threads.add(thread.config["configurable"]["thread_id"])

#     return all_threads


class ChatState(TypedDict):
    messages : Annotated[list[BaseMessage], add_messages]
    summary : str

model = ChatGroq(model = "openai/gpt-oss-120b")

connection = sqlite3.connect("trail.db", check_same_thread=False)
memory = SqliteSaver(conn = connection)


with open("/home/rabboni/Desktop/desktop-automation/chatbot/prompts.json", "r") as f:
    prompts = json.load(f)




async def chat_node(state: ChatState):
    prompt = prompts["sys_prompts"]["chatbot_prompt"]
    sys_prompt = [SystemMessage(content = prompt)]
    responce = await model.ainvoke(sys_prompt + state["messages"])
    return {"messages" : responce}

graph = StateGraph(ChatState)

graph.add_node("chat_node", chat_node)

graph.add_edge(START, "chat_node")
graph.add_edge("chat_node", END)

workflow = graph.compile(checkpointer= memory)


def chatbot(quary, thread_id):
    response = workflow.invoke({"messages" : [HumanMessage(content = quary)]}, config = {"configurable" : {"thread_id" : thread_id}})
    return {"response" : response["messages"][-1].content}