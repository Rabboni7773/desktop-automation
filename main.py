from fastapi import FastAPI, Request, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from chatbot.graph import graph
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
import sqlite3
from uuid import uuid4
import json


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (like your local HTML file)
    allow_credentials=True,
    allow_methods=["*"],  # Allows POST, GET, OPTIONS, etc.
    allow_headers=["*"],
)


templates = Jinja2Templates(directory="/home/rabboni/Desktop/desktop-automation/templates")

thread_id = str(uuid4())

class ChatRequest(BaseModel):
    message: str
    thread_id : str

@app.get("/")
async def home(req : Request):
    return templates.TemplateResponse(req, name = "index.html")

# @app.post("/history/conv_history")
# async def give_conversation_history(req : Request):

#     thread_id = req.path_params['thread_id']

#     conn = sqlite3.connect("/home/rabboni/Desktop/desktop-automation/databases/thread_name.db")

#     cursor = conn.cursor()

#     await cursor.execute("select thread_id, thread_name from thread_name order by time_stamp desc )")

#     data = cursor.fetchall()

#     return {"conv_history" : data} #returns list of tiples



async def gen_response(message : str, thread_id : str):

        async with AsyncSqliteSaver.from_conn_string("databases/conv_storage.db") as mem:
            wf = graph.compile(checkpointer = mem)
            CONFIG = {"configurable" : {"thread_id" : thread_id}}

            async for msg, metadata in wf.astream(
                {"messages" : [HumanMessage(content = message)]},
                config = CONFIG,
                stream_mode="messages"
            ):
                if msg.content:
                    yield msg.content
@app.post("/chat")
async def get_response(req : ChatRequest):
    return StreamingResponse(gen_response(req.message, req.thread_id), media_type="text/plain")
