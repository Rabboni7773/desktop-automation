from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
DB_DIR = BASE_DIR / "databases"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

thread_id = str(uuid4())


class ChatRequest(BaseModel):
    message: str


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)


@app.get("/")
async def home(req: Request):
    use_tailwind = os.getenv("USE_TAILWIND_CDN", "true").lower() == "true"
    return templates.TemplateResponse(request=req, name="index.html", context={"use_tailwind_cdn": use_tailwind})


@app.get("/history/conv_history")
async def give_conversation_history():
    async with aiosqlite.connect(str(DB_DIR / "thread_name.db")) as db:
        async with db.execute("SELECT thread_id, thread_name FROM thread_name ORDER BY time_stamp DESC") as cursor:
            data = await cursor.fetchall()

    formatted_data = []
    for row in data:
        formatted_data.append({
            "thread_id": row[0],
            "thread_name": row[1],
        })

    return {"conv_history": formatted_data}


async def _get_thread_history():
    async with aiosqlite.connect(str(DB_DIR / "thread_name.db")) as db:
        async with db.execute("SELECT thread_id FROM thread_name ORDER BY time_stamp DESC") as cursor:
            data = await cursor.fetchall()

    return [row[0] for row in data]


@app.get("/chat/{thread_id}/history")
async def thread_response(thread_id: str):
    threads = await _get_thread_history()

    if thread_id in threads:
        async with AsyncSqliteSaver.from_conn_string(str(DB_DIR / "conv_storage.db")) as memory:
            wf = graph.compile(checkpointer=memory)
            config = {"configurable": {"thread_id": thread_id}}
            snapshot = await wf.aget_state(config)

            history = []
            for msg in snapshot.values.get("messages", []):
                history.append({"role": msg.type, "content": msg.content})

            return {"messages": history}

    async with aiosqlite.connect(str(DB_DIR / "thread_name.db")) as db:
        await db.execute(
            "INSERT INTO thread_name (thread_name, thread_id) VALUES (?, ?)",
            ("placeholder", thread_id),
        )
        await db.commit()

    return {"messages": []}


@app.get("/chat/{thread_id}/name")
async def _get_thread_name(thread_id: str):
    try:
        async with aiosqlite.connect(str(DB_DIR / "thread_name.db")) as db:
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
        HumanMessage(content=prompt_text),
    ]

    try:
        generated_title = await _model.ainvoke(messages)
        clean_title = generated_title.content.strip()

        async with aiosqlite.connect(str(DB_DIR / "thread_name.db")) as db:
            await db.execute(
                """
                INSERT INTO thread_name (thread_id, thread_name)
                VALUES (?, ?)
                ON CONFLICT(thread_id) DO UPDATE SET thread_name = excluded.thread_name
                """,
                (thread_id, clean_title),
            )
            await db.commit()
            print(f"[Title Saved] '{clean_title}' for thread {thread_id}")

    except Exception as e:
        print(f"[Title Gen Error] Failed for thread {thread_id}: {e}")


@app.post("/chat/{thread_id}")
async def chat_endpoint(thread_id: str, req: ChatRequest):
    async def stream_generator():
        full_ai_response = ""
        threads = await _get_thread_history()
        is_first_message = thread_id not in threads

        async with AsyncSqliteSaver.from_conn_string(str(DB_DIR / "conv_storage.db")) as mem:
            wf = graph.compile(checkpointer=mem)
            config = {"configurable": {"thread_id": thread_id}}

            async for msg, _metadata in wf.astream(
                {"messages": [HumanMessage(content=req.message)]},
                config=config,
                stream_mode="messages",
            ):
                if msg.content:
                    full_ai_response += msg.content
                    yield msg.content

            if is_first_message:
                asyncio.create_task(
                    _generate_and_save_title(thread_id, req.message, full_ai_response)
                )

    return StreamingResponse(stream_generator(), media_type="text/plain")
