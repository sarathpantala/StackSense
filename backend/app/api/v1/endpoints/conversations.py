import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DBSession
from app.api.v1.schemas.conversation import (
    ConversationCreate,
    ConversationDetail,
    ConversationOut,
    MessageCreate,
    MessageOut,
)
from app.services.conversation import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate,
    user: CurrentUser,
    db: DBSession,
):
    service = ConversationService(db)
    conv = await service.create(user.id, body.title)
    return conv


@router.get("", response_model=list[ConversationOut])
async def list_conversations(user: CurrentUser, db: DBSession):
    service = ConversationService(db)
    return await service.list_for_user(user.id)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
):
    service = ConversationService(db)
    conv = await service.get(conversation_id, user.id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser,
    db: DBSession,
):
    service = ConversationService(db)
    deleted = await service.delete(conversation_id, user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def add_message(
    conversation_id: uuid.UUID,
    body: MessageCreate,
    user: CurrentUser,
    db: DBSession,
):
    service = ConversationService(db)
    # Verify ownership
    conv = await service.get(conversation_id, user.id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    message = await service.add_message(conversation_id, body.role, body.content)
    return message


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation_title(
    conversation_id: uuid.UUID,
    body: ConversationCreate,
    user: CurrentUser,
    db: DBSession,
):
    service = ConversationService(db)
    conv = await service.update_title(conversation_id, user.id, body.title)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv
