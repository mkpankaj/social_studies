\# Project Overview
This is a web application to learn social studies for Class 5 stuadents. The application is accessible from all devices (desktop, tablet and mobile) to learn social studies.

\# Key Features of Application
- All chapters of Social Studies will be shown on Homepage.
- User can click on a Chapter Name to open a new page with summary of that Chapter. On this page, there are two buttons "Read Chapter" and "Take Quiz". There is also a Search Bar - Ask AI Assistant at the bottom to ask question using natural language. 
- User can click "Read Chapter" to view detailed content of the chapter. Application will render the pdf doc on screen for reading. It will give a book like feeling to user. User will be able to scroll up and down to read content.
- User can click "Take Quiz" to start quiz of 15 questions for the specific chapter.
- User can enter question in the Search Bar - Ask AI Assistant. Application will search through the chapter contents to answer the query. Application will also search internet to provide additional information with regards to question along with url of source.
- Application will be hosted on internet for users to access. 
- It is one user application. Login / Authentication not needed.
- There is Refresh button on Homepage to load new content. It is three step process: Step 1 - load the docs from folder ./docs/content. Step 2 - extract the content from doc and store in database. Step 3 - create summary of the chapter and store in database

\# Application Workflow
- User lands on Homepage
- User clicks on Refresh. New content is loaded. 
- User clicks on a chapter name. for ex: The Imaginary Lines
- Chapter_Summary page opens
- User clicks on "Read Chapter"
- Chapter_Content page opens
- User clicks on "Take Quiz"
- Quiz page opens
- User enters question in search bar 'Ask AI Assistant'
- New page with answers from Chapter and additional info from internet appears. User can ask follow up question in Search Bar 
- User clicks on Home icon. He goes to Homepage 

\# Business Rules
\## Refresh
- documents (pdf, images etc) will be available in folder ./docs/content.
- Refresh is 03 steps process. Step 1: Loading Files, Step 2: Extracting Content, 
Step 3: Creating Summary  
- Step 1: OCR 
    - Application checks if the doc in ./docs/content folder has already been processed before.
    - if doc is in database and step_1 status = "success" then skip that doc, do not load. Pick next doc from the folder.
    - if doc is in database and step_1 status = "failed" then load the doc, update date & time and step1_status. 
    - if doc is not in database then load doc and update file name, date & time, step1_status 
    - Save docs which are processed successfully. For ex: OCR process of doc 1 to doc 5 is successful but OCR process of doc 6 failed. Doc 1 to Doc 5 are saved in database. Next time OCR will start from Doc 6.
- Step 2: PageIndex   
    - read only text to build hierarchical table of contents by Chapter.
    - run PageIndex for each Chapter, save in database and maintain step2_chapter_status. 
    - if PageIndex of a Chapter is successful then update step2_chapter_status ="success".   
    - if step2_chapter_status is "success" for all chapters in the doc then update step2_status of doc to "success".
    - if step2_chapter_status is "failed" for all chapters in the doc then update step2_status of doc to "failed".
    - if step2_chapter_status is "success" for part of chapters in the doc then update step2_status of doc to "in progress".
    - if step2_chapter_status is blank for all chapters in the doc then update step2_status of doc to blank.
    - check step2_chapter_status of a chapter. If step2_chapter_status = "success" then skip that chapter. Move to next chapter in the doc. If step2_chapter_status = "failed" or blank then start the process.
    - As soon as PageIndex of a Chapter is completed, save it in database. If PageIndex process fails or aborts midway then next time restart the process for Chapters(s) with step2_chapter_status = "failed" or blank.
- Step 3: Summary + Quiz
    - create summary for each Chapter and store in database.
    - run Summary + Quiz for each Chapter, save in database and maintain step3_chapter_status. 
    - if Summary + Quiz of a Chapter is successful then update step3_chapter_status ="success".   
    - if step3_chapter_status is "success" for all chapters in the doc then update step3_status of doc to "success".
    - if step3_chapter_status is "failed" for all chapters in the doc then update step3_status of doc to "failed".
    - if step3_chapter_status is "success" for part of chapters in the doc then update step3_status of doc to "in progress".
    - if step3_chapter_status is blank for all chapters in the doc then update step3_status of doc to blank.
    - check step3_chapter_status of a chapter. If step3_chapter_status = "success" then skip that chapter. Move to next chapter in the doc. If step3_chapter_status = "failed" or blank then start the process.
    - As soon as Summary + Quiz of a Chapter is completed, save it in database. If Summary + Quiz process fails or aborts midway then next time restart the process for Chapters(s) with step3_chapter_status = "failed" or blank.
- Step1, Step 2 and Step 3 will be executed in sequence. Only when previous step of a doc is "success" proceed with next step of that doc.  

\## Search Bar - Ask AI Assistant
- User enters the question
- Application will use hierarchical document structure (PageIndex) method to find the most relevant answer in database. Application will also search internet to provide 02 most relevant answers along with link of source
- it will show the answer on a new page. Refer screen design to know how answers will be displayed on screen.
- Search Bar - Ask AI Assistant will appear on new page to ask follow up questions. 
- There will be cross button to close the page and go back to previous page.
- Conversation will be stored only during the session. Once user closes the session, conversation will be wiped out.
\## Read Chapter
- user clicks on Read Chapter. Chapter_Content page opens up.
- Application will render the docs (pdf / images) on screen.
- user can scroll up and down to read the content.
\## Quiz
- Application refers the exercise at end of chapter and contents of the chapter. Based on this information, it will create a quiz of 15 questions. Questions are stored in database along with Chapter Name. 
- Same questions will be fetched everytime. Only change the order of questions each time a new quiz starts.
- 5 out of 15 questions should be descriptive in nature which requires users to write answers in 2-3 sentences.
- Application will evaluate the answer by matching the user's answers with content of chapter.
- For descriptive question, 85% match will be correct answer.
- Show the questions on screen one by one. After submitting the answer, next question will appear.
- At the end of quiz, show score along with all answers. Provide explanation for wrong answers.
- Do not store the quiz data (score and questions)

\# Reference Documents
- Project Specification doc    ./docs/Project_Spec.md
- Screen Design doc            ./docs/screen-design.md
- Screen Images Folder         ./docs/media
