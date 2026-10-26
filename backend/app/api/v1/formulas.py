import uuid

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import current_auth
from app.schemas.formulas import (
    CustomFormulaIn,
    CustomFormulaOut,
    FormulaLessonOut,
    LessonFormulaIn,
    LessonFormulaOut,
    MarkIn,
    MarkOut,
)
from app.services import formulas as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1", tags=["fórmulas"])

KEY_DOC = "b:<id do catálogo> ou c:<uuid da fórmula própria>"


@router.get("/formulas/marks", response_model=list[MarkOut])
def list_marks(ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.list_marks(db, ctx.user.id)


@router.put("/formulas/marks/{key}", response_model=MarkOut)
def set_mark(
    body: MarkIn,
    key: str = Path(max_length=80, description=KEY_DOC),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    """Favorita e/ou anota uma fórmula. Sem favorito e sem anotação, a marca é removida."""
    return svc.set_mark(db, ctx.user.id, key, body)


@router.get("/formulas/custom", response_model=list[CustomFormulaOut])
def list_custom(ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.list_custom(db, ctx.user.id)


@router.post("/formulas/custom", response_model=CustomFormulaOut, status_code=201)
def create_custom(body: CustomFormulaIn, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.create_custom(db, ctx.user.id, body)


@router.put("/formulas/custom/{formula_id}", response_model=CustomFormulaOut)
def update_custom(
    formula_id: uuid.UUID, body: CustomFormulaIn,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.update_custom(db, ctx.user.id, formula_id, body)


@router.delete("/formulas/custom/{formula_id}", status_code=204)
def delete_custom(formula_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    svc.delete_custom(db, ctx.user.id, formula_id)


@router.get("/formulas/{key}/lessons", response_model=list[FormulaLessonOut])
def lessons_of_formula(
    key: str = Path(max_length=80, description=KEY_DOC),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    return [
        FormulaLessonOut(lesson_id=i, lesson_title=t, subject_name=s)
        for i, t, s in svc.lessons_of_formula(db, ctx.user.id, key)
    ]


@router.get("/lessons/{lesson_id}/formulas", response_model=list[LessonFormulaOut])
def list_lesson_formulas(lesson_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.list_lesson_links(db, ctx.user.id, lesson_id)


@router.post("/lessons/{lesson_id}/formulas", response_model=LessonFormulaOut, status_code=201)
def add_lesson_formula(
    lesson_id: uuid.UUID, body: LessonFormulaIn,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    """Vincula uma fórmula à aula (repetir o pedido não duplica)."""
    return svc.add_lesson_link(db, ctx.user.id, lesson_id, body.formula_key)


@router.delete("/lessons/{lesson_id}/formulas/{key}", status_code=204)
def remove_lesson_formula(
    lesson_id: uuid.UUID,
    key: str = Path(max_length=80, description=KEY_DOC),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    svc.remove_lesson_link(db, ctx.user.id, lesson_id, key)
