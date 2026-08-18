import React from "react";
import ReactDOM from "react-dom/client";
import StudioApp from "./studio/StudioApp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StudioApp />
  </React.StrictMode>,
);
