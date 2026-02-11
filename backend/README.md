# TrackAndGrow Backend

This is the backend server for the TrackAndGrow application. It is built with Node.js, Express, and MongoDB.

## Features

- **Authentication**: User registration and login using JWT.
- **Project Management**: CRUD operations for projects.
- **Task Management**: Create, read, update, and delete tasks.
- **Dashboard**: Aggregated data for user dashboards.
- **Activity Logging**: User activity tracking.
- **Recurring Tasks**: Automated task creation for recurring schedules (Note: Disabled for serverless deployments).

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or Atlas cluster)

## specific Installation

1.  Clone the repository and navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    Create a `.env` file in the root of the `backend` directory based on the example below:
    ```env
    PORT=5000
    MONGO_URI=mongodb://localhost:27017/trackandgrow
    JWT_SECRET=your_jwt_secret_key
    FRONTEND_URL=http://localhost:3000,https://your-frontend-domain.vercel.app
    ```

## Running the Application

### Development Mode
To run the server with `nodemon` for hot-reloading:
```bash
npm run dev
```

### Production Mode
To start the server in production mode:
```bash
npm start
```

## API Documentation

For detailed information about the API endpoints, request bodies, and responses, please refer to [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## Project Structure

- `src/config`: Database connection and configuration.
- `src/controllers`: Request handlers for API routes.
- `src/models`: Mongoose schemas and models.
- `src/routes`: API route definitions.
- `src/middleware`: Custom middleware (auth, error handling, etc.).
- `src/scheduler`: recurring task logic.
- `api/index.js`: Serverless entry point for Vercel deployment.

## Deployment

This project is configured for deployment on Vercel. Ensure you set the environment variables in your Vercel project settings.

## License

ISC
