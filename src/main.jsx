import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { HistoryView } from "./HistoryView.jsx";
import "./styles.css";

const isHistoryView = new URLSearchParams(window.location.search).get("view") === "history";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isHistoryView ? <HistoryView /> : <App />}
  </React.StrictMode>,
);
