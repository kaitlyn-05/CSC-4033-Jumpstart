# **User Requirements**

*Account & Profile*

Users shall be able to create an account.
Users shall be able to log in.
Users shall be able to log out.
Users shall be able to view their profile.<
Users shall be able to view their contribution history.

*Projects*

Users shall be able to create a project.
Users shall be able to provide a project title and description.
Users shall be able to specify the number of hours needed for a project.
Users shall be able to select a project category.
Users shall be able to view project details.
Users shall be able to browse available projects.
Users shall be able to search for projects. 
Project creators shall be able to edit their projects. 
Project creators shall be able to cancel their projects. 
Users shall be able to see a project's current status. 
Users shall be able to create a comment on a project. 
Users shall be able to reply to comments on a project.

*Time Contributions*

Users shall be able to pledge/commit a specific number of hours to a project. 
Users shall be able to see how many hours they have contributed to each project. 
Users shall be able to see the total number of hours contributed to a project. 
Users shall be able to see how many hours remain to reach a project's goal. 
Users shall be able to see a visual representation of project progress. 
Users shall receive confirmation when a time contribution is successfully recorded.

*Crowdsourcing*

Users shall be able to upvote projects. 
Users shall be able to see the number of upvotes a project has received. 
Users shall only be able to cast one active upvote per project. 
Users shall be able to discover projects based on community interest.

*Shared State*

Users shall be able to see project information contributed or changed by other users. 
Time contributions made by one user shall update the project's progress for other users. 
Upvotes made by one user shall update the project's upvote count. 
Project information shall remain available after users leave and return to the application.

*Accessibility*

Users shall be able to access Jumpstart through a web browser. 
Users shall be able to access Jumpstart from different devices. 
Users shall receive useful feedback when an action succeeds or fails.

## *Technical Requirements*

*Frontend*

The frontend shall be developed using React. 
The frontend shall provide interfaces for account management, projects, contributions, and user profiles. 
The frontend shall communicate with the backend through the REST API. 
The frontend shall display project progress dynamically. 
The frontend shall validate user input before submitting data. 
The frontend shall provide appropriate error and success messages. 
The frontend shall have a responsive interface for common desktop and mobile screen sizes.

*Backend*

The backend shall be developed using Node.js. 
The backend shall use Express.js or another Node.js web framework. 
The backend shall provide a REST API. 
The backend shall process authentication requests. 
The backend shall handle project creation, retrieval, updating, and deletion/cancellation. 
The backend shall process time contributions. 
The backend shall process project upvotes. 
The backend shall calculate or retrieve project progress. 
The backend shall validate requests received from the frontend. 
The backend shall return appropriate HTTP status codes and error messages.

*Database & Persistent State*

The application shall use a persistent database. 
The database shall store user information. 
The database shall store project information. 
The database shall store time contributions. 
The database shall store project upvotes. 
The database shall maintain relationships between users, projects, contributions, and upvotes. 
The database shall be hosted through Azure for the deployed application. 
Application data shall persist after a server restart or browser refresh. 
All users shall interact with the same shared database state.

*Azure / Cloud*

The application shall be hosted on Microsoft Azure. 
The web application/backend shall be deployed using Azure App Service. 
The database shall use an Azure-supported database service, such as Azure Database for PostgreSQL. 
The deployed application shall be accessible through the internet. 
Production communication shall use HTTPS. 
If project images/files are included, they shall be stored using Azure Blob Storage rather than directly in the database.

*Authentication & Security*

User authentication shall be implemented securely. 
Passwords shall not be stored as plaintext. 
Protected API endpoints shall require authentication. 
Users shall only be able to modify or cancel projects they are authorized to modify. 
User input shall be validated on the backend. 
Database queries shall be protected against SQL injection. 
Sensitive information shall not be exposed through API responses.

*Development & Deployment*

Source code shall be managed using Git.
The project shall use GitHub for team collaboration and version control. 
The frontend and backend shall be organized as separate application components. 
API endpoints shall follow consistent REST conventions. 
The API shall be documented for team development and testing. 
The application shall include appropriate error handling. 
The application shall be deployable to Azure from the team's development environment.
