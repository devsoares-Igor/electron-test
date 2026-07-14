import "../lib/i18n";
import Splash from "./App";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Splash />
    </StrictMode>,
);

