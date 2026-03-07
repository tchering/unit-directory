# Unit Directory (Full-Stack Mobile)

A mobile-first full-stack app to help new soldiers quickly learn names, faces, ranks, and roles inside a company.

## Stack
- Backend API: Node.js + Express
- Database: PostgreSQL + Prisma
- Mobile app: Expo React Native
- Auth: JWT + role-based access (ADMIN / MANAGER / VIEWER)

## Unit Structure
- Regiment: `3e Régiment du Matériel`
- Company: `15e Compagnie`
- Sections: `Section 1`, `Section 2`, `Section 3`

## 1) Run Backend API
Make sure PostgreSQL is running and create the database:
```bash
createdb unit_directory
```

Then run:
```bash
cd server
npm install
npm run db:setup
npm run dev
```

API runs at `http://localhost:4000/api`.

## Admin bootstrap
Create or reset the first admin account:
```bash
cd server
npm run admin:create -- your-admin@email.com your-strong-password
```

Then login in the mobile app using that account.

## Registration + Roles
- Users can register in-app with `email + password + password confirmation`.
- All self-registered users are created as `VIEWER` (read-only).
- Only `ADMIN` and `MANAGER` can add soldiers.
- `VIEWER` users can log in and browse/search only.
- `ADMIN` can open **Manage User Roles** in the app and promote/demote users (`VIEWER` / `MANAGER` / `ADMIN`).

## 2) Run Mobile App
```bash
cd mobile
npm install
npm run start
```

Then open on:
- iOS Simulator (`i` in Expo terminal)
- Android Emulator (`a` in Expo terminal)
- Expo Go on your phone (scan QR)

## API base URL for physical phone
If testing on a real phone, `localhost` points to the phone itself. Set your laptop LAN IP:

```bash
cd mobile
EXPO_PUBLIC_API_BASE="http://<YOUR_COMPUTER_IP>:4000/api" npm run start
```

Example:
```bash
EXPO_PUBLIC_API_BASE="http://192.168.1.25:4000/api" npm run start
```

## Implemented Features
1. Home screen with company + section list
2. Section screen with soldier cards (photo, name, rank, role)
3. Soldier profile screen
4. Soldier search by name
5. Dark tactical UI with large photos
