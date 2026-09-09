export interface MockLab {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  scopes: string[];
  status: "BIS recognised" | "NABL accredited";
  phone: string;
  email: string;
}

export const MOCK_LABS: MockLab[] = [
  { id: "nth-vadodara", name: "National Test House, Western Region", address: "Gorwa, Vadodara", city: "Vadodara", state: "Gujarat", scopes: ["Cement", "Steel", "Electrical"], status: "BIS recognised", phone: "+91 265 239 7800", email: "nth-vadodara@example.in" },
  { id: "geri-vadodara", name: "Gujarat Engineering Research Institute", address: "Race Course Circle, Vadodara", city: "Vadodara", state: "Gujarat", scopes: ["Cement", "Water", "Construction"], status: "NABL accredited", phone: "+91 265 233 0121", email: "labdesk@example.in" },
  { id: "cpri-bengaluru", name: "Central Power Research Institute", address: "Prof. Sir C. V. Raman Road, Bengaluru", city: "Bengaluru", state: "Karnataka", scopes: ["Electrical", "Batteries", "EV charging"], status: "BIS recognised", phone: "+91 80 2360 1350", email: "testing@example.in" },
  { id: "nabl-pune", name: "National Test House, Western Centre", address: "Pashan Road, Pune", city: "Pune", state: "Maharashtra", scopes: ["Cement", "Steel", "PPE"], status: "NABL accredited", phone: "+91 20 2587 1234", email: "pune.lab@example.in" },
  { id: "clri-chennai", name: "Central Leather Research Institute", address: "Adyar, Chennai", city: "Chennai", state: "Tamil Nadu", scopes: ["Footwear", "Leather", "Chemicals"], status: "BIS recognised", phone: "+91 44 2443 7150", email: "quality@example.in" },
  { id: "npl-delhi", name: "National Physical Laboratory", address: "Dr K. S. Krishnan Marg, New Delhi", city: "New Delhi", state: "Delhi", scopes: ["Electrical", "Consumer products", "Metrology"], status: "BIS recognised", phone: "+91 11 2659 2600", email: "testing@npl.example.in" },
  { id: "cmet-hyderabad", name: "Centre for Materials Technology", address: "Cherlapally, Hyderabad", city: "Hyderabad", state: "Telangana", scopes: ["Batteries", "Electronics", "EV charging"], status: "NABL accredited", phone: "+91 40 2726 1000", email: "contact@example.in" },
  { id: "food-kolkata", name: "Food Research and Testing Laboratory", address: "Salt Lake, Kolkata", city: "Kolkata", state: "West Bengal", scopes: ["Food", "Water", "Packaging"], status: "BIS recognised", phone: "+91 33 2334 4200", email: "foodlab@example.in" },
  { id: "toy-jaipur", name: "Rajasthan Product Safety Laboratory", address: "Sitapura Industrial Area, Jaipur", city: "Jaipur", state: "Rajasthan", scopes: ["Toys", "PPE", "Consumer products"], status: "NABL accredited", phone: "+91 141 277 1180", email: "helpdesk@example.in" },
  { id: "solar-bhopal", name: "Renewable Energy Test Centre", address: "Govindpura, Bhopal", city: "Bhopal", state: "Madhya Pradesh", scopes: ["Solar", "Electrical", "Pumps"], status: "BIS recognised", phone: "+91 755 258 4400", email: "solar.testing@example.in" },
];