import "../lib/i18n";
import Offline from "./App";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Offline />
    </StrictMode>,
);

