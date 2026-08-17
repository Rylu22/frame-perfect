"use client";

import { useActionState } from "react";
import { createList, type CreateListState } from "./actions";

const initialState: CreateListState = { error: null };

export default function CreateListForm() {
  const [state, formAction, pending] = useActionState(createList, initialState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="name">List name</label>
        <input
          type="text"
          id="name"
          name="name"
          placeholder="e.g. Frame Perfect Top 50"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="targetSize">How many levels on this list?</label>
        <input type="number" id="targetSize" name="targetSize" min={1} defaultValue={25} />
      </div>
      <div className="field">
        <label htmlFor="rules">
          Rules for record submissions{" "}
          <span style={{ textTransform: "none", letterSpacing: 0 }}>(shown to players)</span>
        </label>
        <textarea
          id="rules"
          name="rules"
          placeholder="e.g. Video must show the full attempt with no cuts..."
        />
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create List"}
      </button>
      <div className={`msg ${state.error ? "error" : ""}`}>{state.error}</div>
    </form>
  );
}
