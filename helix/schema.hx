// Nodes
N::User {
    userId: String,
    mobile: String,
    name: String,
    email: String,
    country: String
}
N::Business {
    businessId: String,
    name: String,
    mobile: String,
    logo: String
}
N::Product {
    businessId: String,
    productName: String,
    productOrService: String,
    costPrice: F64,
    salePrice: F64,
    productId: String,
    quantityAvailable: I64,
    expiryDate: I64
}
N::Sale {
    businessId: String,
    saleId: String,
    costPrice: F64,
    salePrice: F64,   
    totalAmount: F64,
    totalDue: F64,
    saleDate: I64,
    fees: F64,
    paymentMethod: String, // "Cash", "Card", "Transfer", "Mixed"
    paymentStatus: String // "Partially_Paid", "Paid", "Refunded", "Unpaid"
}
N::History {
    businessId: String,
    entity: String, // "Product", "Sale", "Customer", "Supplier", "Invoice", "Expense", "User", "Business"
    entityId: String, // ID of the entity
    userId: String,
    action: String, // "Created", "Updated", "Deleted"
    timestamp: I64
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
    From: Business,
    To: User,
    Properties: {
        role: String,           // "Owner", "Accountant", "Bookkeeper"
        permissions: [String],  // ["read", "write", "admin"]
        joinedAt: I64,
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

E::SaleBy {
    From: Sale,
    To: User,
    Properties: {
      
    }
}
E::SaleTo {
    From: Sale,
    To: Customer,
    Properties: {
   
    }
}
E::SoldAt {
    From: Sale,
    To: Business,
    Properties: {
      
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