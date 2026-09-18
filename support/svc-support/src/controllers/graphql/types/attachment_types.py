import strawberry
from typing import Optional


@strawberry.type
class Attachment:
    id: str
    file_name: str
    file_size: int
    file_type: str
    url: str
    uploaded_at: str

    @classmethod
    def from_dict(cls, data: dict) -> "Attachment":
        return cls(
            id=data.get("id", ""),
            file_name=data.get("fileName", ""),
            file_size=data.get("fileSize", 0),
            file_type=data.get("fileType", ""),
            url=data.get("url", ""),
            uploaded_at=data.get("uploadedAt", ""),
        )
