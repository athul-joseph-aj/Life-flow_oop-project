import java.util.ArrayList;
import java.util.HashMap;
import java.util.Scanner;

// Abstract class: ABSTRACTION
abstract class Person {
    private String name;
    private int age;
    private String phone;

    public Person(String name, int age, String phone) {
        this.name = name;
        this.age = age;
        this.phone = phone;
    }

    // ENCAPSULATION through getters
    public String getName() {
        return name;
    }

    public int getAge() {
        return age;
    }

    public String getPhone() {
        return phone;
    }

    public abstract void displayInfo();
}

// INHERITANCE: Donor inherits from Person
class Donor extends Person {
    private int donorId;
    private String bloodGroup;

    public Donor(int donorId, String name, int age, String phone, String bloodGroup) {
        super(name, age, phone);
        this.donorId = donorId;
        this.bloodGroup = bloodGroup;
    }

    public int getDonorId() {
        return donorId;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    // POLYMORPHISM: overriding abstract method
    @Override
    public void displayInfo() {
        System.out.println("Donor ID    : " + donorId);
        System.out.println("Name        : " + getName());
        System.out.println("Age         : " + getAge());
        System.out.println("Phone       : " + getPhone());
        System.out.println("Blood Group : " + bloodGroup);
    }
}

// Stores receiver details when a request cannot be fulfilled
class BloodRequest {
    private String receiverName;
    private int receiverAge;
    private String receiverPhone;
    private String bloodGroup;
    private int quantity;

    public BloodRequest(String receiverName, int receiverAge, String receiverPhone,
                        String bloodGroup, int quantity) {
        this.receiverName = receiverName;
        this.receiverAge = receiverAge;
        this.receiverPhone = receiverPhone;
        this.bloodGroup = bloodGroup;
        this.quantity = quantity;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    public void displayRequest() {
        System.out.println("Receiver Name : " + receiverName);
        System.out.println("Age           : " + receiverAge);
        System.out.println("Phone         : " + receiverPhone);
        System.out.println("Blood Group   : " + bloodGroup);
        System.out.println("Quantity      : " + quantity + " unit(s)");
        System.out.println("Status        : Pending");
    }
}

// Manages donors, stock and pending requests
class BloodBank {
    private ArrayList<Donor> donors = new ArrayList<>();
    private ArrayList<BloodRequest> pendingRequests = new ArrayList<>();
    private HashMap<String, Integer> bloodStock = new HashMap<>();

    public BloodBank() {
        String[] groups = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"};
        for (String group : groups) {
            bloodStock.put(group, 0);
        }
    }

    public void addDonor(Donor donor) {
        donors.add(donor);
        System.out.println("\nDonor added successfully.");
    }

    public void viewAllDonors() {
        if (donors.isEmpty()) {
            System.out.println("\nNo donors registered.");
            return;
        }

        System.out.println("\n===== ALL DONORS =====");
        for (Donor donor : donors) {
            donor.displayInfo();
            System.out.println("----------------------------");
        }
    }

    public void searchByBloodGroup(String group) {
        group = normalize(group);
        boolean found = false;

        System.out.println("\n===== SEARCH RESULT =====");
        for (Donor donor : donors) {
            if (donor.getBloodGroup().equalsIgnoreCase(group)) {
                donor.displayInfo();
                System.out.println("----------------------------");
                found = true;
            }
        }

        if (!found) {
            System.out.println("No donor found for blood group " + group);
        }
    }

    public void searchByDonorId(int id) {
        for (Donor donor : donors) {
            if (donor.getDonorId() == id) {
                System.out.println("\n===== DONOR FOUND =====");
                donor.displayInfo();
                return;
            }
        }
        System.out.println("\nNo donor found with ID " + id);
    }

    public void addBloodStock(String group, int quantity) {
        group = normalize(group);

        if (!isValidBloodGroup(group)) {
            System.out.println("\nInvalid blood group.");
            return;
        }

        if (quantity <= 0) {
            System.out.println("\nQuantity must be greater than 0.");
            return;
        }

        bloodStock.put(group, bloodStock.get(group) + quantity);
        System.out.println("\nBlood stock updated successfully.");
        System.out.println(group + " stock: " + bloodStock.get(group) + " unit(s)");
    }

    public void viewBloodStock() {
        System.out.println("\n===== BLOOD STOCK =====");
        for (String group : bloodStock.keySet()) {
            System.out.println(group + " : " + bloodStock.get(group) + " unit(s)");
        }
    }

    public void requestBlood(String receiverName, int receiverAge, String receiverPhone,
                             String group, int quantity) {
        group = normalize(group);

        if (!isValidBloodGroup(group)) {
            System.out.println("\nInvalid blood group.");
            return;
        }

        if (quantity <= 0) {
            System.out.println("\nQuantity must be greater than 0.");
            return;
        }

        int available = bloodStock.get(group);

        System.out.println("\n===== BLOOD REQUEST =====");
        System.out.println("Receiver Name : " + receiverName);
        System.out.println("Age           : " + receiverAge);
        System.out.println("Phone         : " + receiverPhone);
        System.out.println("Blood Group   : " + group);
        System.out.println("Required      : " + quantity + " unit(s)");
        System.out.println("Available     : " + available + " unit(s)");

        if (available >= quantity) {
            bloodStock.put(group, available - quantity);
            System.out.println("\nBlood request successful.");
            System.out.println("Blood has been issued successfully.");
            System.out.println("Remaining " + group + " stock: " + bloodStock.get(group) + " unit(s)");
        } else {
            pendingRequests.add(
                new BloodRequest(receiverName, receiverAge, receiverPhone, group, quantity)
            );
            System.out.println("\nInsufficient blood stock.");
            System.out.println("Request has been added to pending requests.");
        }
    }

    public void viewPendingRequests() {
        if (pendingRequests.isEmpty()) {
            System.out.println("\nNo pending blood requests.");
            return;
        }

        System.out.println("\n===== PENDING BLOOD REQUESTS =====");
        int count = 1;

        for (BloodRequest request : pendingRequests) {
            System.out.println("\nRequest " + count);
            System.out.println("----------------------------");
            request.displayRequest();
            System.out.println("Currently Available : "
                    + bloodStock.get(request.getBloodGroup()) + " unit(s)");
            count++;
        }
    }

    private String normalize(String group) {
        return group.trim().toUpperCase();
    }

    private boolean isValidBloodGroup(String group) {
        return bloodStock.containsKey(group);
    }
}

public class Main {
    private static final Scanner scanner = new Scanner(System.in);

    public static void main(String[] args) {
        BloodBank bank = new BloodBank();
        int choice;

        System.out.println("==============================================");
        System.out.println("       BLOOD BANK MANAGEMENT SYSTEM");
        System.out.println("==============================================");

        do {
            displayMenu();
            choice = readInt("Enter your choice: ");

            switch (choice) {
                case 1:
                    addDonor(bank);
                    break;
                case 2:
                    bank.viewAllDonors();
                    break;
                case 3:
                    bank.searchByBloodGroup(readText("Enter blood group: "));
                    break;
                case 4:
                    bank.searchByDonorId(readInt("Enter donor ID: "));
                    break;
                case 5:
                    bank.addBloodStock(
                        readText("Enter blood group: "),
                        readInt("Enter quantity: ")
                    );
                    break;
                case 6:
                    bank.viewBloodStock();
                    break;
                case 7:
                    requestBlood(bank);
                    break;
                case 8:
                    bank.viewPendingRequests();
                    break;
                case 9:
                    System.out.println("\nThank you for using Blood Bank Management System!");
                    break;
                default:
                    System.out.println("\nInvalid choice. Please enter 1 to 9.");
            }
        } while (choice != 9);

        scanner.close();
    }

    private static void displayMenu() {
        System.out.println("\n===== MAIN MENU =====");
        System.out.println("1. Add Donor");
        System.out.println("2. View All Donors");
        System.out.println("3. Search Donor by Blood Group");
        System.out.println("4. Search Donor by ID");
        System.out.println("5. Add Blood Stock");
        System.out.println("6. View Blood Stock");
        System.out.println("7. Request Blood");
        System.out.println("8. View Pending Blood Requests");
        System.out.println("9. Exit");
    }

    private static void addDonor(BloodBank bank) {
        System.out.println("\n===== ADD DONOR =====");

        int id = readInt("Enter Donor ID: ");
        String name = readText("Enter Name: ");
        int age = readInt("Enter Age: ");
        String phone = readText("Enter Phone: ");
        String group = readText("Enter Blood Group: ");

        Donor donor = new Donor(id, name, age, phone, group);
        bank.addDonor(donor);
    }

    private static void requestBlood(BloodBank bank) {
        System.out.println("\n===== REQUEST BLOOD =====");

        String name = readText("Enter Receiver Name: ");
        int age = readInt("Enter Receiver Age: ");
        String phone = readText("Enter Receiver Phone: ");
        String group = readText("Enter Required Blood Group: ");
        int quantity = readInt("Enter Required Quantity: ");

        bank.requestBlood(name, age, phone, group, quantity);
    }

    // Exception handling for invalid integer input
    private static int readInt(String message) {
        while (true) {
            try {
                System.out.print(message);
                return Integer.parseInt(scanner.nextLine().trim());
            } catch (NumberFormatException e) {
                System.out.println("Invalid input. Please enter a number.");
            }
        }
    }

    private static String readText(String message) {
        while (true) {
            System.out.print(message);
            String input = scanner.nextLine().trim();

            if (!input.isEmpty()) {
                return input;
            }

            System.out.println("Input cannot be empty.");
        }
    }
}
