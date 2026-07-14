import "../lib/i18n";
import Titlebar from "./App";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Titlebar />
    </StrictMode>,
);

