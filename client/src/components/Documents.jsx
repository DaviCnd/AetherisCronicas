import React, { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { api } from "../lib/api";

export default function Documents({ profiles }) {
  const [docs, setDocs] = useState([]);
  const [current, setCurrent] = useState(null);
  const [title, setTitle] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] })
    ],
    content: "<p>Comece a escrever...</p>"
  });

  async function refresh() {
    setDocs(await api("/api/documents"));
  }

  useEffect(() => { refresh(); }, []);

  async function createDoc() {
    const title = prompt("Título:", "Novo documento");
    if (!title) return;

    const result = await api("/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title,
        profile_id: profiles[0]?.id || null,
        content_json: { type: "doc", content: [] }
      })
    });

    await refresh();
    await openDoc(result.id);
  }

  async function openDoc(id) {
    const doc = await api(`/api/documents/${id}`);
    setCurrent(doc);
    setTitle(doc.title);
    editor?.commands.setContent(doc.content_json);
  }

  async function save() {
    if (!current || !editor) return;
    await api(`/api/documents/${current.id}`, {
      method: "PUT",
      body: JSON.stringify({
        title,
        visibility: current.visibility || "private",
        content_json: editor.getJSON()
      })
    });
    refresh();
  }

  return (
    <section>
      <header className="page-head row-between">
        <div>
          <span className="eyebrow">DOCUMENTOS</span>
          <h1>Biblioteca narrativa</h1>
        </div>
        <button className="primary" onClick={createDoc}>Novo documento</button>
      </header>

      <div className="split">
        <aside className="doc-list">
          {docs.map(doc => (
            <button key={doc.id} onClick={() => openDoc(doc.id)}>
              <strong>{doc.title}</strong>
              <small>{doc.visibility}</small>
            </button>
          ))}
        </aside>

        <article className="editor-shell">
          {current ? (
            <>
              <input className="doc-title" value={title} onChange={e => setTitle(e.target.value)} />
              <div className="toolbar">
                <button onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
                <button onClick={() => editor.chain().focus().toggleBulletList().run()}>Lista</button>
                <button onClick={() => editor.chain().focus().toggleBlockquote().run()}>Citação</button>
                <button onClick={() => editor.chain().focus().setTextAlign("left").run()}>←</button>
                <button onClick={() => editor.chain().focus().setTextAlign("center").run()}>↔</button>
                <button onClick={() => editor.chain().focus().setTextAlign("right").run()}>→</button>
              </div>

              <EditorContent editor={editor} className="editor" />
              <div className="save-row"><button className="primary" onClick={save}>Salvar</button></div>
            </>
          ) : (
            <div className="empty">Selecione ou crie um documento.</div>
          )}
        </article>
      </div>
    </section>
  );
}
