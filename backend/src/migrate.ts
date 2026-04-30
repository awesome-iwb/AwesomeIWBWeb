import fs from 'fs';
import path from 'path';

// Define regex patterns to match elements
const categoryRegex = /^### (.+)$/;
const projectRegex = /^### \[(.*?)\]\((.*?)\) \| (.*?)$/;
const projectAlternativeRegex = /^### (.*?) \| (.*?)$/; // Fallback if no link
const badgeRegex = /!\[(.*?)\]\((.*?)\)/g;
const keywordRegex = /🏷.*?\*\*(.*?)\*\*(.*)/;
const singleKeywordBadgeRegex = /!\[(.*?)\]\(.*?\)/g;
const reviewRegex = /💬 \*\*(.*?)\*\*\s*(.*)/;
const quoteRegex = /^>\s*(.*)/;
const linkRegex = /\[(.*?)\]\((.*?)\)/g;

function parseMarkdown(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const categories: any[] = [];
  let currentCategory: any = null;
  let currentProject: any = null;
  let isInProjectsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Detect when we enter the main content section (skip intro)
    if (line.startsWith('## 📚 速览')) {
      isInProjectsSection = true;
      continue;
    }

    if (!isInProjectsSection) continue;

    // Detect category (e.g., "### ✏️ 屏幕批注与白板软件")
    const catMatch = line.match(categoryRegex);
    if (catMatch && !line.includes('|') && (line.includes('软件') || line.includes('工具') || line.includes('系统') || line.includes('类') || line.includes('资源'))) {
      const catName = catMatch[1].trim();
      currentCategory = {
        id: Buffer.from(catName).toString('base64').substring(0, 10).replace(/[^a-zA-Z0-9]/g, ''), // Simple ID
        name: catName,
        description: "",
        projects: []
      };
      categories.append(currentCategory);
      currentProject = null;
      continue;
    }

    // Category Description
    if (currentCategory && !currentProject && line.startsWith('>')) {
       currentCategory.description += line.replace('>', '').trim() + " ";
       continue;
    }

    // Detect Project
    // Typical format: "### [Ink Canvas Plus](https://github.com/clover-yan/Ink-Canvas-Plus) | Clover Yan"
    // Or just "### Seewo Custom Start | HM2001"
    let isProject = false;
    let projName = "";
    let devName = "";
    let projUrl = "";

    const projMatch = line.match(projectRegex);
    if (projMatch) {
      projName = projMatch[1].trim();
      projUrl = projMatch[2].trim();
      devName = projMatch[3].trim();
      isProject = true;
    } else {
      const altMatch = line.match(projectAlternativeRegex);
      if (altMatch && !line.includes('速览') && currentCategory) {
        projName = altMatch[1].trim();
        devName = altMatch[2].trim();
        isProject = true;
      }
    }

    if (isProject) {
      currentProject = {
        name: projName,
        developer: devName,
        status: "活跃", // Default
        recommendation: "",
        github_url: projUrl,
        avatar: `https://github.com/${devName.split(' ')[0]}.png`, // Best guess
        description: "",
        keywords: [],
        reviews: [],
        links: []
      };
      currentCategory.projects.push(currentProject);
      continue;
    }

    // Parse Project Details
    if (currentProject) {
      // Badges (Status, Recommendation)
      if (line.startsWith('<div align="center">') || line.startsWith('![') || line.startsWith('[![')) {
         let badgesLine = line;
         // Sometimes they are in a block
         if (line.startsWith('<div')) {
           while (i + 1 < lines.length && !lines[i+1].includes('</div>')) {
             i++;
             badgesLine += " " + lines[i];
           }
           i++; // skip </div>
         }

         let match;
         while ((match = badgeRegex.exec(badgesLine)) !== null) {
            const altText = match[1].toLowerCase();
            const badgeUrl = match[2].toLowerCase();
            
            if (altText.includes('推荐') || badgeUrl.includes('recommend')) {
               if (badgeUrl.includes('orange') || badgeUrl.includes('非常推荐')) currentProject.recommendation = '🥇 非常推荐';
               else if (badgeUrl.includes('blue') || badgeUrl.includes('值得尝试')) currentProject.recommendation = '🥈 值得尝试';
               else currentProject.recommendation = '🌟 推荐';
            }
            if (altText.includes('停更') || badgeUrl.includes('停更')) {
               currentProject.status = '停更';
            }
         }
         continue;
      }

      // Keywords
      if (line.startsWith('🏷')) {
         let match;
         while ((match = singleKeywordBadgeRegex.exec(line)) !== null) {
            currentProject.keywords.push(match[1]);
         }
         if (currentProject.keywords.length === 0) {
            // Fallback for plain text keywords
            const kwText = line.replace('🏷', '').replace(/\*\*/g, '').replace('关键词：', '').trim();
            currentProject.keywords = kwText.split(/[,，、 ]+/).filter((k: string) => k.length > 0);
         }
         continue;
      }

      // Reviews
      const revMatch = line.match(reviewRegex);
      if (revMatch) {
         currentProject.reviews.push({
           author: revMatch[1].trim(),
           content: revMatch[2].replace(/^：|:/, '').trim()
         });
         continue;
      }

      // Quotes (Notes)
      if (line.startsWith('>')) {
         // Skip if it's a note block inside project
         continue;
      }

      // Links Table (skip HTML table parsing for simplicity, just grab raw URLs if needed, but we have github_url)
      if (line.startsWith('<table') || line.startsWith('<tr>') || line.startsWith('<td>')) {
         continue;
      }
      
      // Horizontal rules
      if (line.startsWith('---') || line.startsWith('***')) {
         continue;
      }

      // Description (anything else that is plain text)
      if (!line.startsWith('<') && !line.startsWith('![')) {
         currentProject.description += line + " ";
      }
    }
  }

  // Cleanup
  categories.forEach(cat => {
    cat.description = cat.description.trim();
    cat.projects.forEach((proj: any) => {
      proj.description = proj.description.trim();
      // If recommendation is empty, give a default
      if (!proj.recommendation) proj.recommendation = '🌟';
      if (!proj.github_url && proj.developer) {
        proj.github_url = `https://github.com/${proj.developer.split(' ')[0]}/${proj.name.replace(/\s+/g, '-')}`;
      }
    });
  });

  return { categories };
}

const mdPath = path.resolve(__dirname, '../../README.md');
const outputPath = path.resolve(__dirname, './data.json');

const parsedData = parseMarkdown(mdPath);
fs.writeFileSync(outputPath, JSON.stringify(parsedData, null, 2), 'utf-8');
console.log('Migration completed successfully. Extracted', parsedData.categories.length, 'categories.');
