# Receipt Organizer Implementation Plan

## Goal Description
Build a modern, dynamic web application that allows users to upload receipt images and bank account copies, extracts the data (mocked for this phase), and organizes it into an interactive Excel-like table. 

Key features include:
- A beautiful, glassmorphism-styled UI with smooth animations.
- Specific columns: ID, Date, Vendor, Description, Supply Value, Tax, Total, Bank Name, Account Number, Account Holder, Note.
- Interactive "Deposit Completed" checkbox that highlights the row in yellow when checked.
- Edit functionality for modifying incorrectly extracted or manually entered data.

## User Review Required
> [!IMPORTANT]
> The image text extraction (OCR) requires a backend service or external API (such as Google Cloud Vision API, Clova OCR, etc.). For this initial implementation, I will build the **frontend web app with a mock extraction logic** so you can see and interact with the UI. If you have a specific OCR API in mind, please let me know, and we can integrate it later.

> [!CAUTION]
> The application will be a web application built using React and Vanilla CSS, running locally on your machine.

## Proposed Changes

### Web Application Setup
- **Framework**: React via Vite
- **Styling**: Vanilla CSS with modern aesthetics (gradients, glassmorphism, fluid typography)
- **Directory**: `C:\Users\burn2\.gemini\antigravity\scratch\receipt_organizer`

### Components
- **File Uploader**: A drag-and-drop zone with a sleek design for uploading images.
- **Loading Overlay**: A spinner/progress bar that simulates the OCR processing.
- **Data Table**:
  - A custom HTML table with robust CSS styling.
  - State management in React to handle rows.
  - **Inline Editing**: Allows the user to click `수정` (Edit), changing the row into input fields.
  - **Deposit Highlight**: Checking the `입금 완료` (Deposit Completed) box will add a specific CSS class that turns the row background yellow.

## Verification Plan
### Automated Tests
- N/A for this straightforward UI implementation.

### Manual Verification
- Start the Vite development server.
- Upload a dummy file, verify the "Processing" animation.
- Verify that a new row appears in the table.
- Test the edit button and save functionality.
- Test checking the "Deposit Completed" checkbox and ensure the row highlights correctly.
