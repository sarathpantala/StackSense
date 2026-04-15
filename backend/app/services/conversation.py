import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.conversation import Conversation, Message


class ConversationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: uuid.UUID, title: str = "New Chat") -> Conversation:
        conversation = Conversation(user_id=user_id, title=title)
        self.db.add(conversation)
        await self.db.flush()
        await self.db.refresh(conversation)
        return conversation

    async def list_for_user(self, user_id: uuid.UUID) -> list[Conversation]:
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def add_message(self, conversation_id: uuid.UUID, role: str, content: str) -> Message:
        message = Message(conversation_id=conversation_id, role=role, content=content)
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return message

    async def update_title(self, conversation_id: uuid.UUID, user_id: uuid.UUID, title: str) -> Conversation | None:
        conv = await self.get(conversation_id, user_id)
        if conv:
            conv.title = title
            await self.db.flush()
            await self.db.refresh(conv)
        return conv

    async def delete(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            delete(Conversation).where(
                Conversation.id == conversation_id, Conversation.user_id == user_id
            )
        )
        return result.rowcount > 0
