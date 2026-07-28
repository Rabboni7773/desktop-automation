from fastapi import FastAPI, Request, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from chatbot.graph import graph
from langchain_groq import ChatGroq
from chatbot.prompts import NAME_GEN_PROMPT
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel
from uuid import uuid4
import asyncio
import aiosqlite
from dotenv import load_dotenv

load_dotenv()


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

@app.get("/")
async def home(req : Request):
    return templates.TemplateResponse(req, name = "index.html")

# need to call when page is loaded as it gives thread_names and respective thread_ids in dict 
@app.get("/history/conv_history")
async def give_conversation_history():
    
    async with aiosqlite.connect("/home/rabboni/Desktop/desktop-automation/databases/thread_name.db") as db:
        
        async with db.execute("SELECT thread_id, thread_name FROM thread_name ORDER BY time_stamp DESC") as cursor:
            data = await cursor.fetchall()
    formatted_data = []
    for row in data:
        formatted_data.append({
            "thread_id": row[0],
            "thread_name": row[1]
        })

    return {"conv_history": formatted_data}


async def _get_thread_history():
    async with aiosqlite.connect("/home/rabboni/Desktop/desktop-automation/databases/thread_name.db") as db:
        # Added the missing 'time_stamp' column to the ORDER BY clause
        async with db.execute("SELECT thread_id FROM thread_name ORDER BY time_stamp DESC") as cursor:
            data = await cursor.fetchall()
            
    # Flatten the tuples into a simple list of strings: ["id1", "id2", "id3"]
    return [row[0] for row in data]


# need to call after creating a new thread or already stored thread it gives a list containing messages
@app.get("/chat/{thread_id}/history")
async def thread_response(thread_id: str): 

    threads = await _get_thread_history()
    
    if thread_id in threads:
        async with AsyncSqliteSaver.from_conn_string("databases/conv_storage.db") as memory:
            wf = graph.compile(checkpointer=memory)
            CONFIG = {"configurable": {"thread_id": thread_id}}

            # 3. Changed to aget_state() for async checkpointer
            snapshot = await wf.aget_state(CONFIG)
            
            history = []
            for msg in snapshot.values.get("messages", []):
                history.append({"role": msg.type, "content": msg.content})

            # 4. Outdented the return statement so the entire loop finishes!
            return {"messages": history}
            
    else:
        async with aiosqlite.connect("/home/rabboni/Desktop/desktop-automation/databases/thread_name.db") as db:
            await db.execute(
                "INSERT INTO thread_name (thread_name, thread_id) VALUES (?, ?)", 
                ('placeholder', thread_id)
            ) 
            await db.commit()
            
        # 7. Return an empty array so the frontend knows to start a blank screen
        return {"messages": []}


# frontend need to call this after executing first message
@app.get("/chat/{thread_id}/name")
async def _get_thread_name(thread_id: str):
    try:
        async with aiosqlite.connect("/home/rabboni/Desktop/desktop-automation/databases/thread_name.db") as db:
            
            async with db.execute("SELECT thread_name FROM thread_name WHERE thread_id = ?", (thread_id,)) as cursor:
                row = await cursor.fetchone()
                
                if row is None:
                    return {"thread_name": "New Chat"}
                    
                return {"thread_name": row[0]}

    except Exception as e:
        print(f"Error at _get_thread_name: {e}")
        return {"thread_name": "New Chat"}


async def _generate_and_save_title(thread_id: str, user_message: str, ai_response: str):
    _model = ChatGroq(model="openai/gpt-oss-120b", temperature=0.4)
    
    prompt_text = f"user_msg : {user_message}\nai_message : {ai_response}"
    messages = [
        SystemMessage(content=NAME_GEN_PROMPT),
        HumanMessage(content=prompt_text)
    ]
    
    try:
        generated_title = await _model.ainvoke(messages)
        clean_title = generated_title.content.strip()

        async with aiosqlite.connect("/home/rabboni/Desktop/desktop-automation/databases/thread_name.db") as db:
            await db.execute(
                """
                INSERT INTO thread_name (thread_id, thread_name)
                VALUES (?, ?)
                ON CONFLICT(thread_id) DO UPDATE SET thread_name = excluded.thread_name
                """,
                (thread_id, clean_title)
            )
            await db.commit()
            print(f"[Title Saved] '{clean_title}' for thread {thread_id}")

    except Exception as e:
        print(f"[Title Gen Error] Failed for thread {thread_id}: {e}")


# need to call this to get responce from llm
@app.post("/chat/{thread_id}")
async def chat_endpoint(thread_id: str, req: ChatRequest):

    async def stream_generator():
        full_ai_response = ""
        
        # Check if history exists to determine if this is the first turn
        threads = await _get_thread_history()
        is_first_message = thread_id not in threads
        
        async with AsyncSqliteSaver.from_conn_string("databases/conv_storage.db") as mem:
            wf = graph.compile(checkpointer=mem)
            config = {"configurable": {"thread_id": thread_id}}

            async for msg, metadata in wf.astream(
                {"messages": [HumanMessage(content=req.message)]},
                config=config,
                stream_mode="messages"
            ):
                if msg.content:
                    full_ai_response += msg.content
                    yield msg.content

            # Trigger background title generation after streaming finishes
            if is_first_message:
                asyncio.create_task(
                    _generate_and_save_title(thread_id, req.message, full_ai_response)
                )

    return StreamingResponse(stream_generator(), media_type="text/plain")
