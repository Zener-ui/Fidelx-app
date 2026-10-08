import client from "./client";

export const getWallet = () => client.get("/wallet");
export const getWalletFundingAccount = () => client.post("/wallet/funding-account");
export const getWalletTransactions = () => client.get("/wallet/transactions");
export const getWalletTopups = () => client.get("/wallet/topups");
