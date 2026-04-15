# Special Resources Feature

The Special Resources feature allows users to share their skills, capabilities, and availability with others on the map. This enhances coordination by making it easy to see what specialized resources are currently on duty.

## Overview

Users can add their special skills or resources (like K-9 units, drone operators, etc.) for the duration of their tour of duty. These resources are automatically removed once the tour ends. The feature uses Eastern Standard Time (EST) for all time calculations.

## Features

- **View Available Resources**: Users can see all currently active special resources, who they belong to, and how much time remains in their tour.
- **Add Your Resource**: Users can add their own special resource by specifying:
  - Department
  - Special skill/capability (from dropdown)
  - Additional details (optional)
  - Tour start and end times
- **Automatic Expiration**: Resources are automatically marked as inactive once their tour end time is reached.
- **Time Zone Handling**: All times are stored in UTC but displayed in EST for consistency.

## Technical Implementation

### Database Structure

The feature uses two main database tables:

1. **Special Resource Categories** (`special_resource_categories`):
   - Stores the predefined list of special skills/resources that users can select
   - Fields: `id`, `name`, `description`, `created_at`, `updated_at`

2. **Special Resources** (`special_resources`):
   - Stores the individual resource entries made by users
   - Fields: `id`, `user_id`, `user_email`, `user_name`, `department`, `category_id`, `skill_description`, `tour_start`, `tour_end`, `is_active`, `created_at`, `updated_at`

### API Endpoints

The backend exposes these RESTful endpoints:

- `GET /api/special-resources` - Get all active special resources
- `GET /api/special-resources/categories` - Get all available categories for the dropdown
- `POST /api/special-resources` - Add a new special resource
- `PUT /api/special-resources/:id` - Update an existing resource (owner or admin only)
- `DELETE /api/special-resources/:id` - Deactivate a resource (owner or admin only)
- `GET /api/special-resources/user/:userEmail` - Get resources for a specific user

### Frontend Components

The feature is implemented with these React components:

- `SpecialResourcesModal` - Main modal component with tabs for viewing and adding resources
- Button integration in the MapboxMobileMap header

### Automated Cleanup

A cron job runs hourly to deactivate any resources whose tour end times have passed. This ensures that the system only shows current, active resources.

## Usage Guide

1. **Viewing Resources**:
   - Click the "Special Resources" button in the mobile map header
   - The modal will open showing all currently active resources
   - Resources nearing expiration (< 1 hour remaining) will be highlighted

2. **Adding Your Resource**:
   - Click the "Add Resource" tab in the Special Resources modal
   - Fill in your department and select your special skill
   - Add any optional details about your capability
   - Set your tour start and end times
   - Click "Add Special Resource"

3. **Resource Expiration**:
   - Your resource will automatically be marked inactive when the tour end time is reached
   - No manual deletion is needed

## Security and Permissions

- Users can only edit or delete their own resources
- Administrators can manage all resources
- All API endpoints are protected and require authentication

## Future Enhancements

Potential future improvements to the Special Resources feature:

1. **Resource Categories Management**: Admin interface to add/edit the available resource categories
2. **Resource Assignment**: Ability for supervisors to assign resources to specific incidents
3. **Notification System**: Alert when a needed resource becomes available
4. **Map Integration**: Option to display special resources on the map with custom icons
5. **Recurring Tours**: Support for setting up recurring tour patterns 