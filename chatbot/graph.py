from langgraph.graph import START, StateGraph, END
from langgraph.graph.message import add_messages, RemoveMessage
from langgraph.checkpoint.memory import InMemorySaver
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage
from langchain_core.messages.utils import trim_messages, count_tokens_approximately
from prompts import SYSTEM_PROMPT_SUMMARY, SYSTEM_PROMPT_NOT_SUMMARY, CHATBOT_SYS_PROMPT
from dotenv import load_dotenv
from typing import TypedDict, Annotated, Literal
import asyncio


load_dotenv()

_MAX_TOKENS_ALLOWED = 4096

# def all_threads():
#     all_threads = set()
#     for thread in memory.list(None):
#         all_threads.add(thread.config["configurable"]["thread_id"])

#     return all_threads


class ChatState(TypedDict):
    messages : Annotated[list[BaseMessage], add_messages]
    summary : str


def _num_tokens(state : ChatState):
    if state.get("summary"):
        return count_tokens_approximately([state.get("summary")] + state["messages"])
    else:
        return count_tokens_approximately(state["messages"])



model = ChatGroq(model = "openai/gpt-oss-120b")

summary_model = ChatGroq(model = "openai/gpt-oss-120b", temperature = 0.2)

async def message_summarizer(state : ChatState):

    remaining_msgs = trim_messages(
        state["messages"],
        max_tokens = _MAX_TOKENS_ALLOWED,
        strategy = "last",
        token_counter = count_tokens_approximately,
        allow_partial = False
    )

    remaining_ids = {msg.id for msg in remaining_msgs}

    extra_msgs = [msg for msg in state["messages"] if msg.id not in remaining_ids]

    if not extra_msgs:
        return {}

    current_summary = state.get("summary")

    if current_summary:
        prompt = [SystemMessage(content = SYSTEM_PROMPT_SUMMARY), HumanMessage(content = f"Summary : {current_summary} \n Extra Messages : {extra_msgs}")]

    else:
        prompt = [SystemMessage(content = SYSTEM_PROMPT_NOT_SUMMARY), HumanMessage(content = f"Extra Messages : {extra_msgs}")]

    summary_generated = await summary_model.ainvoke(prompt).content

    return {"summary" : summary_generated, "messages" : [RemoveMessage(id = msg.id) for msg in extra_msgs]}

async def chat_node(state: ChatState):
    sys_prompt = [SystemMessage(content = CHATBOT_SYS_PROMPT)]
    responce = await model.ainvoke(sys_prompt + [state.get("summary", " ")] + state["messages"])
    return {"messages" : responce}

def token_summarize_check_node(state : ChatState) -> Literal["exceed", "in_limit"]:
    num_tokens = _num_tokens(state)

    if num_tokens >= _MAX_TOKENS_ALLOWED:
        return "exceed"
    else:
        return "in_limit"

graph = StateGraph(ChatState)

graph.add_node("chat_node", chat_node)
graph.add_node("message_summarizer", message_summarizer)

graph.add_conditional_edges(START, token_summarize_check_node, {"exceed" : "message_summarizer", "in_limit" : "chat_node"})
graph.add_edge("message_summarizer", "chat_node")
graph.add_edge("chat_node", END)


if __name__ == "__main__":
    mem = InMemorySaver()

    wf = graph.compile(checkpointer= mem)

    config = {"configurable" : {"thread_id" : "user_1"}}

    while True:
        user_ip = input("Human : ")
        if user_ip.lower().strip() == "exit":
            break
        res = asyncio.run(wf.ainvoke({"messages" : HumanMessage(content = user_ip)}, config = config))
        print(res["messages"][-1].content)