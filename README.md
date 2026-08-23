# Remix of ROOP MVPv0.1 by Cherie

We are building a rental management platform called ROOP.

ROOP is a clothing rental website that connects customers with a fashion rental store. The system contains two portals:

Customer Portal

Vendor Portal

For this MVP we are testing with a single vendor store, but the architecture should support multiple vendors in the future. 

The system has two user roles:

Customer

Browse available rental items

View product details

Select rental dates

Add items to a bag

Send a rental request to the store

Track the status of their order

Vendor

The vendor manages store operations through a vendor portal.

Add and edit product listings

Upload product images

Manage inventory

View incoming rental requests

Approve or reject orders

Input delivery fees manually

View each transaction including customer profile and rented product item

Confirm payment manually

Update order status throughout the rental lifecycle

Inventory Management:

Inventory is tracked at the serial level. Each product has multiple physical units identified by a unique serial ID. When a customer sends a rental request, an available unit should be reserved immediately.

Payment Logic:

Payments are handled manually for this MVP. Vendors will confirm payment manually in the system.

Pricing Rules:

Products have a daily rental rate

The store has a single deposit amount that applies to all products

Rental total includes only rental fees

Deposit and delivery fees are stored separately

Vendors manually input delivery fees into the transaction record

MVP Constraints:

The system must support customers, vendors, products, inventory units, bookings, and booking items

Keep the architecture clean and scalable for future prompts

System Goal:

The system should support the following flow:

customer browsing → booking request → vendor approval → payment confirmation → rental tracking

Critical Instruction:

Generate only the landing page first.

The landing page should include a clear switch, tab, or toggle that lets users view two landing states:

Customer

Vendor

Customer landing state:

Focus on a marketing-style landing page that introduces ROOP as a clothing rental platform for customers.

Vendor landing state:

Focus on inviting existing fashion rental vendors to create their online store with ROOP and manage rentals digitally.

Do not generate customer portal pages, vendor portal pages, internal dashboards, or booking system pages yet.

We will also be using Supabase with this project on top of lovable

We will build the rest step by step in future prompts.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5e20ade2-72c4-4326-ad5e-b755122ff727).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
