// Use IndexedDB for storage
let db;
const dbName = "CommentTreeDB";
const commentsStore = "comments";
let comments = [];

// Initialize the database
const request = indexedDB.open(dbName, 1);

request.onerror = function(event) {
    console.error("Database error: " + event.target.errorCode);
};

request.onupgradeneeded = function(event) {
    db = event.target.result;
    const objectStore = db.createObjectStore(commentsStore, { keyPath: "id" });
    objectStore.createIndex("parent_id", "parent_id", { unique: false });
};

request.onsuccess = function(event) {
    db = event.target.result;
    loadComments();
};

// Load comments from IndexedDB
function loadComments() {
    const transaction = db.transaction([commentsStore], "readonly");
    const objectStore = transaction.objectStore(commentsStore);
    const request = objectStore.getAll();

    request.onsuccess = function(event) {
        comments = event.target.result;
        displayComments();
    };

    request.onerror = function(event) {
        console.error("Error loading comments");
    };
}

// Save a comment to IndexedDB
function saveComment(comment) {
    const transaction = db.transaction([commentsStore], "readwrite");
    const objectStore = transaction.objectStore(commentsStore);
    const request = objectStore.add(comment);

    request.onsuccess = function(event) {
        comments.push(comment);
        displayComments();
    };

    request.onerror = function(event) {
        console.error("Error saving comment");
    };
}

// Add a new comment
function addComment(parentId) {
    let commentText;

    if (parentId === null) {
        commentText = document.getElementById("newCommentText").value.trim();
        document.getElementById("newCommentText").value = "";
    } else {
        const replyInput = document.getElementById(`replyInput-${parentId}`);
        commentText = replyInput.value.trim();
        replyInput.value = "";

        // Hide reply form
        document.getElementById(`replyForm-${parentId}`).style.display = "none";
    }

    if (commentText === "") return;

    const newComment = {
        id: Date.now().toString(),
        text: commentText,
        parent_id: parentId,
        timestamp: new Date().toISOString()
    };

    saveComment(newComment);
}

// Toggle reply form
function toggleReplyForm(commentId) {
    const replyForm = document.getElementById(`replyForm-${commentId}`);
    replyForm.style.display = replyForm.style.display === "none" ? "block" : "none";
}

// Build a tree structure from flat comments
function buildCommentTree() {
    const commentMap = {};
    const rootComments = [];

    // Initialize map with all comments
    comments.forEach(comment => {
        commentMap[comment.id] = {
            ...comment,
            children: []
        };
    });

    // Build the tree
    comments.forEach(comment => {
        if (comment.parent_id === null) {
            rootComments.push(commentMap[comment.id]);
        } else if (commentMap[comment.parent_id]) {
            commentMap[comment.parent_id].children.push(commentMap[comment.id]);
        }
    });

    return rootComments;
}

// Render a comment and its children recursively
function renderComment(comment) {
    let html = `
        <div class="comment-item" id="comment-${comment.id}">
            <div class="comment-content">${comment.text}</div>
            <div class="comment-actions">
                <button onclick="toggleReplyForm('${comment.id}')">Reply</button>
            </div>
            <div class="reply-form" id="replyForm-${comment.id}">
                <input type="text" id="replyInput-${comment.id}" placeholder="Write a reply...">
                <button onclick="addComment('${comment.id}')">Submit</button>
            </div>
            <div class="child-comments" id="children-${comment.id}">
                ${comment.children.map(child => renderComment(child)).join('')}
            </div>
        </div>
    `;
    return html;
}

// Display all comments
function displayComments() {
    const commentTree = buildCommentTree();
    const commentsListElement = document.getElementById("commentsList");

    commentsListElement.innerHTML = commentTree.map(comment => renderComment(comment)).join('');
}

// Generate DOT format for Graphviz
function generateDOT() {
    let dot = 'digraph CommentTree {\n';
    dot += '  node [shape=box, style=filled, fillcolor=lightblue];\n';

    // Add nodes
    comments.forEach(comment => {
        // Escape quotes in the comment text
        const escapedText = comment.text.replace(/"/g, '\\"');
        // Truncate long comments
        const displayText = escapedText.length > 20 ?
            escapedText.substring(0, 20) + '...' :
            escapedText;

        dot += `  "${comment.id}" [label="${displayText}"];\n`;
    });

    // Add edges
    comments.forEach(comment => {
        if (comment.parent_id) {
            dot += `  "${comment.parent_id}" -> "${comment.id}";\n`;
        }
    });

    dot += '}';
    return dot;
}

// Visualize the graph using d3-graphviz
function visualizeGraph() {
    const dot = generateDOT();
    d3.select("#graphOutput").graphviz()
        .renderDot(dot);
}

// Export DOT format
function exportDOT() {
    const dot = generateDOT();
    document.getElementById("dotOutput").value = dot;

    // Optional: Create a downloadable file
    const blob = new Blob([dot], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'comment_tree.dot';
    a.click();

    URL.revokeObjectURL(url);
}
