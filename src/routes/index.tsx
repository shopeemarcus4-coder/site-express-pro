import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "../features/marketing/MarketingPage";

export const Route = createFileRoute("/")({ component: MarketingPage });
