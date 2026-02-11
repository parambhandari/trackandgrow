# Track & Grow API Documentation

## Base URL
`http://localhost:5000/api`

## Authentication
All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Auth Routes (`/api/auth`)

### POST `/api/auth/register`
Register a new user
- **Access**: Public
- **Body**: 
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "employee" // optional, defaults to "employee"
  }
  ```

### POST `/api/auth/login`
Login user
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Response**: Returns user object with token

### GET `/api/auth/profile`
Get current user profile
- **Access**: Private

### GET `/api/auth/users`
Get all users (Admin only)
- **Access**: Private/Admin

---

## Project Routes (`/api/projects`)

### GET `/api/projects`
Get all projects
- **Access**: Private
- **Response**: Array of projects with `tasksCount` and `completedTasks` calculated

### POST `/api/projects`
Create a new project
- **Access**: Private/Admin
- **Body**:
  ```json
  {
    "name": "Project Name",
    "category": "Web Development",
    "iconColor": "bg-purple-100 text-purple-600",
    "initial": "P",
    "team": ["userId1", "userId2"],
    "modules": [],
    "folders": [],
    "files": []
  }
  ```

### GET `/api/projects/:id`
Get project by ID
- **Access**: Private
- **Response**: Project with stats

### PUT `/api/projects/:id`
Update a project
- **Access**: Private/Admin
- **Body**: Partial project data

### DELETE `/api/projects/:id`
Delete a project (also deletes all associated tasks)
- **Access**: Private/Admin

### POST `/api/projects/:id/modules`
Add a module to a project
- **Access**: Private/Admin
- **Body**:
  ```json
  {
    "name": "Module Name"
  }
  ```

### DELETE `/api/projects/:id/modules/:moduleId`
Delete a module from a project
- **Access**: Private/Admin

### POST `/api/projects/:id/folders`
Add a folder to a project
- **Access**: Private/Admin
- **Body**:
  ```json
  {
    "name": "Folder Name",
    "moduleId": "moduleId123" // optional
  }
  ```

### PATCH `/api/projects/:id/folders/:folderId`
Rename a folder
- **Access**: Private/Admin
- **Body**:
  ```json
  {
    "name": "New Folder Name"
  }
  ```

### DELETE `/api/projects/:id/folders/:folderId`
Delete a folder (also deletes all files in it)
- **Access**: Private/Admin

### POST `/api/projects/:id/files/upload`
Upload a file to Cloudinary and add it to the project.
- **Access**: Private
- **Content-Type**: `multipart/form-data`
- **Body**: `file` (required), `folderId` (optional, for placing file in a folder)
- **Requires**: Backend env `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Without these, upload returns 503.

### POST `/api/projects/:id/files`
Add a file to a project (metadata only; use `/files/upload` for Cloudinary upload)
- **Access**: Private
- **Body**:
  ```json
  {
    "name": "file.pdf",
    "type": "pdf",
    "url": "https://example.com/file.pdf",
    "size": "2.5 MB",
    "moduleId": "moduleId123", // optional
    "folderId": "folderId123" // optional
  }
  ```

### DELETE `/api/projects/:id/files/:fileId`
Delete a file from a project
- **Access**: Private

---

## Task Routes (`/api/tasks`)

### GET `/api/tasks`
Get all tasks
- **Access**: Private
- **Response**: Array of tasks formatted for frontend

### GET `/api/tasks/:id`
Get task by ID
- **Access**: Private

### POST `/api/tasks`
Create a new task
- **Access**: Private
- **Body**:
  ```json
  {
    "title": "Task Title",
    "description": "Task description",
    "priority": "High",
    "deadline": "16-Aug-2025",
    "project": "Project Name" or "projectId",
    "assignee": "userId", // optional, defaults to current user
    "tags": ["tag1", "tag2"],
    "subtasks": [
      {
        "id": "s1",
        "title": "Subtask 1",
        "completed": false
      }
    ],
    "recurring": "Daily", // "Daily", "Weekly", "Monthly", or null
    "moduleId": "moduleId123" // optional
  }
  ```

### PUT `/api/tasks/:id`
Update a task
- **Access**: Private
- **Body**: Partial task data

### DELETE `/api/tasks/:id`
Delete a task
- **Access**: Private (Admin or task reporter)

### PATCH `/api/tasks/:id/status`
Update task status
- **Access**: Private
- **Body**:
  ```json
  {
    "status": "In Progress" // "To Do", "In Progress", "Review", "Completed"
  }
  ```
- **Note**: Automatically handles recurring tasks when status changes to "Completed"

### PATCH `/api/tasks/:id/progress`
Update task progress (0-100)
- **Access**: Private
- **Body**:
  ```json
  {
    "progress": 50
  }
  ```

---

## Dashboard Routes (`/api/dashboard`)

### GET `/api/dashboard/stats`
Get dashboard statistics
- **Access**: Private
- **Response**:
  ```json
  {
    "totalProjects": 5,
    "completedTasks": 12,
    "inProgressTasks": 8,
    "dueTodayTasks": 3
  }
  ```

---

## Activity Routes (`/api/activity`)

### GET `/api/activity/analytics`
Get activity analytics
- **Access**: Private
- **Response**:
  ```json
  {
    "weeklyOverview": [
      {
        "name": "Mon",
        "tasks": 4,
        "completed": 2
      }
    ],
    "productivityTrend": [
      {
        "name": "Wk 1",
        "score": 400
      }
    ],
    "projectActivity": [
      {
        "id": "projectId",
        "name": "Project Name",
        "status": "Active",
        "completion": 75
      }
    ]
  }
  ```

---

## Data Format Notes

### Date Format
- **Input**: Accepts both Date objects and strings in format "DD-MMM-YYYY" (e.g., "16-Aug-2025")
- **Output**: Returns dates as strings in format "DD-MMM-YYYY"

### Task Status Flow
- Tasks can move: `To Do` → `In Progress` → `Review` → `Completed`
- Completed tasks cannot be moved back
- Tasks in "To Do" must move to "In Progress" first

### Recurring Tasks
- When a recurring task is marked as "Completed", a new instance is automatically created with:
  - Status: "To Do"
  - Deadline: Calculated based on recurring frequency (Daily/Weekly/Monthly)
  - All other fields copied from original task

### Project Stats
- `tasksCount`: Total number of tasks in the project
- `completedTasks`: Number of completed tasks
- Calculated automatically on GET requests

---

## Error Responses

All errors follow this format:
```json
{
  "message": "Error message here"
}
```

Common status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Server Error
