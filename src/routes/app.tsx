import { createFileRoute } from "@tanstack/react-router";
import { AppPage } from "../features/app/AppPage";

export const Route = createFileRoute("/app")({ component: AppPage });
