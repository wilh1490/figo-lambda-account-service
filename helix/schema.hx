// Nodes
N::User {
    userId: String,
    mobile: String,
    name: String,
    email: String,
    country: String,
    joinedAt: I64
}
N::Business {
    businessId: String,
    name: String,
    mobile: String,
    logo: String,
    joinedAt: I64
}
N::Product {
    businessId: String,
    productName: String,
    category: String,
    costPrice: F64,
    salePrice: F64,
    productId: String,
    quantityAvailable: I64,
    expiryDate: I64,
    addedAt: I64
}
N::Customer {
    businessId: String,
    name: String,
    mobile: String
}
N::Supplier {
    businessId: String,
    name: String,
    mobile: String
}

// Vector embeddings for content
V::UserEmbedding { text: String }
V::BusinessEmbedding { text: String }
V::ProductEmbedding { text: String }
V::CustomerEmbedding { text: String }
V::SupplierEmbedding { text: String }

// User access to businesses
E::Staff {
    From: User,
    To: Business,
    Properties: {
        role: String,           // "Owner", "Accountant", "Bookkeeper"
        permissions: [String],  // ["read", "write", "admin"]
        startDate: I64,
        lastActive: String
    }
}
E::MyCustomers {
    From: Business,
    To: Customer,
    Properties: {
        role: String,           // "Owner", "Accountant", "Bookkeeper"
        permissions: [String],  // ["read", "write", "admin"]
        startDate: I64,
        lastActive: String
    }
}
E::MySuppliers {
    From: Business,
    To: Supplier,
    Properties: {
        role: String,           // "Owner", "Accountant", "Bookkeeper"
        permissions: [String],  // ["read", "write", "admin"]
        startDate: I64,
        lastActive: String
    }
}
E::MyProducts {
    From: Business,
    To: Product,
    Properties: {
        role: String,           // "Owner", "Accountant", "Bookkeeper"
        permissions: [String],  // ["read", "write", "admin"]
        startDate: I64,
        lastActive: String
    }
}

// Sales transactions
E::PurchasedBy {
    From: Customer,
    To: Customer,
    Properties: {
        sale_date: I64,
        total_amount: F64
    }
}

E::SoldTo {
    From: Sale,
    To: Customer,
    Properties: {
        sale_date: I64,
        total_amount: F64
    }
}

E::SaleItem {
    From: Sale,
    To: Product,
    Properties: {
        quantity: I64,
        unit_price: F64,
        discount: F64
    }
}

// Invoice relationships
E::InvoiceFor {
    From: Invoice,
    To: Sale,
    Properties: {
        invoice_date: I64,
        due_date: I64,
        status: String  // "Draft", "Sent", "Paid", "Overdue"
    }
}

// Business has customers
E::HasCustomer {
    From: Business,
    To: Customer,
    Properties: {
        credit_limit: F64,
        payment_terms: String,  // "Net 30", "COD"
        since: I64
    }
}

// Business has suppliers
E::HasSupplier {
    From: Business,
    To: Supplier,
    Properties: {
        credit_limit: F64,
        payment_terms: String,
        since: I64
    }
}

// Payment relationships
E::PaymentFor {
    From: Payment,
    To: Invoice,
    Properties: {
        payment_date: I64,
        amount: F64,
        method: String  // "Cash", "Check", "Card", "Transfer"
    }
}

// Expense relationships
E::ExpenseBy {
    From: Expense,
    To: Business,
    Properties: {
        expense_date: I64,
        category: String,  // "Office", "Travel", "Utilities"
        receipt_url: String
    }
}

E::PaidTo {
    From: Expense,
    To: Supplier,
    Properties: {
        payment_method: String
    }
}