from fastapi import FastAPI, HTTPException
from mlc_chat import ChatModule, ChatConfig, ConvConfig
from pydantic import BaseModel, conint, confloat

app = FastAPI()

cm = ChatModule('Llama-2-7b-chat-hf-q4f16_1')

class ChatRequest(BaseModel):
    message: str
    system: str = None  # Conversation system prompt
    max_gen_len: conint(ge=0) = 256  # constrain to non-negative values
    temperature: confloat(ge=0.0) = 1.0  # constrain to non-negative values
    # Add other fields as needed

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        conv_config = ConvConfig(system=request.system)
        chat_config = ChatConfig(max_gen_len=request.max_gen_len, temperature=request.temperature, conv_config=conv_config)
        
        cm.reset_chat(chat_config)

        # Get response from the model
        output = cm.generate(prompt=request.message)
        return {"response": output}

    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8085)