from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.v1.auth import session_out
from app.config import Settings
from app.core.db import get_db
from app.core.deps import current_auth, get_app_settings
from app.schemas.auth import (
    ChangePasswordIn,
    DeleteAccountIn,
    PreferencesIn,
    ProfileUpdateIn,
    SessionOut,
)
from app.services import auth as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1/users/me", tags=["usuário"])


@router.get("", response_model=SessionOut)
def me(ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return session_out(db, ctx)


@router.patch("", response_model=SessionOut)
def update_profile(
    body: ProfileUpdateIn, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)
):
    ctx.user.display_name = body.display_name
    db.commit()
    return session_out(db, ctx)


@router.patch("/preferences", response_model=SessionOut)
def update_preferences(
    body: PreferencesIn, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)
):
    prefs = svc.get_preferences(db, ctx.user)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(prefs, field, value)
    db.commit()
    return session_out(db, ctx)


@router.post("/password", status_code=204)
def change_password(
    body: ChangePasswordIn, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)
):
    svc.change_password(
        db, ctx, current_password=body.current_password, new_password=body.new_password
    )


@router.delete("", status_code=204)
def delete_account(
    body: DeleteAccountIn,
    response: Response,
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    svc.delete_account(db, ctx, password=body.password)
    response.delete_cookie(settings.session_cookie_name, path="/")
