import uuid

from fastapi import APIRouter, Depends, File, Response, UploadFile
from sqlalchemy.orm import Session

from app.config import Settings
from app.core.db import get_db
from app.core.deps import current_auth, get_app_settings
from app.core.errors import AppError
from app.schemas.library import AttachmentOut
from app.services import attachments as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1", tags=["imagens"])


@router.post("/lessons/{lesson_id}/attachments", response_model=AttachmentOut, status_code=201)
def upload_image(
    lesson_id: uuid.UUID,
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    """Envia uma imagem (PNG, JPEG ou WebP). O conteúdo é verificado, recodificado e reduzido no servidor;
    o tipo declarado pelo navegador e o nome do arquivo são ignorados."""
    raw = file.file.read(settings.max_upload_bytes + 1)  # lê no máximo o limite + 1 byte
    if len(raw) > settings.max_upload_bytes:
        raise AppError(413, f"A imagem passa de {settings.max_upload_bytes // 1_000_000} MB. Reduza o tamanho e tente de novo.")
    return svc.upload(db, settings, ctx.user.id, lesson_id, raw)


@router.get("/attachments/{attachment_id}/content")
def image_content(attachment_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    attachment = svc.get_with_data(db, ctx.user.id, attachment_id)
    return Response(
        content=attachment.data,
        media_type=attachment.mime_type,
        headers={
            "Cache-Control": "private, max-age=3600",  # o conteúdo de um id nunca muda; privado: só no navegador do dono
            "ETag": f'"{attachment.sha256}"',
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_image(attachment_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    svc.delete(db, ctx.user.id, attachment_id)
