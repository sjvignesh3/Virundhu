export interface PublicMenuStore {
    id: string;
    slug: string;
    name: string;
    tamilName: string | null;
    description: string | null;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    imageUrl: string | null;
    status: "OPEN" | "CLOSED";
    settings: {
        defaultLanguage: "en" | "ta";
        showTamilNames: boolean;
        showUnavailable: boolean;
        acceptOrders: boolean;
        minimumOrderValue: number;
        estimatedPreparationMinutes: number;
    };
}
export interface PublicMenuProduct {
    id: string;
    name: string;
    tamilName: string | null;
    description: string | null;
    tamilDescription: string | null;
    price: number;
    unit: string;
    imageUrl: string | null;
    stockQuantity: number | null;
    isAvailable: boolean;
    displayOrder: number;
}
export interface PublicMenuCategory {
    id: string;
    name: string;
    tamilName: string | null;
    description: string | null;
    displayOrder: number;
    products: PublicMenuProduct[];
}
export interface PublicMenu {
    slug: string;
    store: PublicMenuStore;
    categories: PublicMenuCategory[];
}
export declare const publicMenuRepo: {
    bySlug(slug: string): Promise<PublicMenu>;
};
