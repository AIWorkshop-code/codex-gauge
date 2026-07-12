import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { AnnouncementView } from "./AnnouncementView.jsx";
import { HistoryView } from "./HistoryView.jsx";
import "./styles.css";

const view = new URLSearchParams(window.location.search).get("view");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {view === "history" ? <HistoryView /> : (view === "announcement" ? <AnnouncementView /> : <App />)}
  </React.StrictMode>,
);
