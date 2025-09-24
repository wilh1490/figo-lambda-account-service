QUERY addUser(
    userId: String,
    businessId: String,
    text: String,
    joinedAt: Date
) =>
    vec <- AddN<User>({
        userId: userId,
        businessId: businessId,
        text: text,
        joinedAt: joinedAt,
    })
    RETURN vec


QUERY addUserE(
    userId: String,
    businessId: String,
    text: String,
    embedding: [F64],
    joinedAt: Date
) =>
    vec <- AddV<UserE>(embedding, {
        userId: userId,
        businessId: businessId,
        text: text,
        joinedAt: joinedAt,
    })
    RETURN vec


    QUERY searchUserE(query_vector: [F64], limit: I64) =>
    results <- SearchV<UserE>(query_vector, limit)
    RETURN results


// Add staff
QUERY AddStaff(userID: ID, businessID: ID, role: String, department: String, lastActive: Date ) =>
    AddE<Staff>({
        role: role,
        department: department,
        joinedAt: NOW,
        lastActive: lastActive
    })::From(N<User>(userID))::To(N<Business>(businessID))
    RETURN "Staff added successfully"

// Get all employees of a business
QUERY GetStaff(businessID: ID) =>
    staff <- N<Business>(businessID)::In<Staff>
    RETURN staff

// Get all businesses where user works
QUERY GetUserEmployers(userID: ID) =>
    employers <- N<User>(userID)::Out<Staff>
    RETURN employers

QUERY GetStaffDetails(userID: ID, businessID: ID) =>
    staff_relationship <- N<User>(userID)::OutE<Staff>::WHERE(_::ToN::ID::EQ(businessID))
    RETURN staff_relationship::{
        role: _::{role},
        department: _::{department},
        joinedAt: _::{joinedAt},
        lastActive: _::{lastActive}
    }


