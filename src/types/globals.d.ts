declare const firebase: any;
declare const Chart: any;

interface Window {
  doQuickAdd: (qa: any) => void;
  deleteQuickAdd: (id: string) => void;
  deletePurchase: (id: string) => void;
  deleteGrocery: (id: string) => void;
  toggleGrocery: (id: string) => void;
  deleteIncome: (id: string) => void;
  deleteTopUp: (id: string) => void;
  settleDebt: (id: string) => void;
  deleteDebt: (id: string) => void;
  deleteSubscription: (id: string) => void;
}
