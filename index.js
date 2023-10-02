var blockFills = ["rgb(255, 255, 255)", "rgb(0, 0, 0)", "rgb(0, 255, 0)", "rgb(192, 217, 255)", 0, "rgb(191, 191, 191)", 0, 0, "rgb(204, 136, 153)", "rgb(230, 180, 255)", "rgb(160, 255, 205)"]
var triggerFills = {
  JumpSquare: [0, "rgb(0,200,255)", "rgb(225, 170, 70)", "rgb(80,220,20)"],
  ToolkitChange: "rgb(191,200,5)",
  Camera: "rgba(0,0,0,255)",
};
var blockSizes = [50, 50, 50, 50, 30, 50, 30, 30, 50, 50, 50];
var playerFills = ["rgba(127,127,127,63)", "rgba(0,200,255,63)", "rgba(255,150,0,63)", "rgba(67,198,0,63)", "rgba(225,235,90,63)", "rgba(250,100,255,63)"];
var blocks; //0: Empty, 1: Wall, 2: Goal, 3: Ice, 4: Jump Refill, 5: Semisolid (up), 6: Double Jump Refill, 7: Triple Refill, 8: Downward jet, 9: Gravity flip, 10: No gravity
// When adding to blocks, also add to: blockFills, blockSizes, BLOCK_PRIORITY
var triggers; //List of Objects
var x = 0;
var y = 0;
var dx;
var dy;
var width;
var height;
var heldKeys = new Set();
var jumpsLeft;
var coyoteFrames;
var jumpBufferFrames;
var jumpHeld = false;
var curFriction = 0;
var groundJumps = 1;
var bestLevel = parseInt(localStorage.getItem("level"));
if (isNaN(bestLevel)) {
  bestLevel = 0;
  localStorage.setItem("level", "0");
}
var level = -2;
var menu = 2; //0: Wait, 1: In game, 2: Level Select
var cursorLevel = bestLevel;
var scrollX;
var scrollY;
var scrollDx;
var scrollDy;
var minCamX;
var minCamDx;
var maxCamX;
var maxCamDx;
var minCamY;
var minCamDy;
var maxCamY;
var maxCamDy;
var finalCameraX;
var finalCameraY;
var BLOCK_PRIORITY = [0, 9, 8, 10, 2, 5, 3, 1]; //Order of priority for colliding with blocks. Right means more priority.
var SOLID_BLOCKS = new Set([1, 3]);
var JUMP_HEIGHT = 10;
var MOVE_SPEED = 8;
var GROUND_FRICTION = 0.1;
var AIR_FRICTION = 0;
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
function genLevelLists(json) {
  var newLevelData = JSON.parse(json);
  width = 20;
  height = 20;
  groundJumps = 1;
  
  blocks = newLevelData.blocks;
  triggers = newLevelData.triggers;
  x = newLevelData.x;
  y = newLevelData.y;
  if ("doubleJumps" in newLevelData) {
    groundJumps = newLevelData.doubleJumps;
  }
  if ("width" in newLevelData) {
    width = newLevelData.width;
  }
  if ("height" in newLevelData) {
    height = newLevelData.height;
  }
  
  createJumpSquareTriggers();
  x -= width/2;
  y -= height;
  dx = 0;
  dy = 0;
  scrollX = 0;
  scrollY = 0;
  scrollDx = 0;
  scrollDy = 0;
  minCamX = 0;
  minCamY = 0;
  minCamDx = 0;
  minCamDy = 0;
  maxCamX = blocks[0].length*50-600;
  maxCamY = blocks.length*50-600;
  maxCamDx = 0;
  maxCamDy = 0;
  finalCameraX = 0;
  finalCameraY = 0;
  jumpsLeft = groundJumps;
  coyoteFrames = 0;
  jumpBufferFrames = 0;
  curFriction = GROUND_FRICTION;
  blockCooldowns = [];
  
  menu = 1;
}
function awaitWebLevel(file) {
  console.log(file);
  file.text().then(genLevelLists);
}
function setup(){
  menu = 2;
  var newLevel = document.getElementById("level-input").files[0];
  if (level >= 0 && level<= bestLevel) {
    var url = "https://raw.githubusercontent.com/tom-fibo/Frictionless-Platformer/main/LevelData/Level" + (level + 1) + ".json"
    fetch(url).then(awaitWebLevel);
    menu = 0;
  } else if (level === bestLevel + 1) {
    if (newLevel !== undefined) {
      newLevel.text().then(genLevelLists);
      menu = 0;
    }
  }
}
function createJumpSquareTriggers() {
  for (var i=0; i<blocks.length; i++) {
    for (var j=0; j<blocks.length; j++) {
      var id = blocks[i][j];
      if (id === 4 || id === 6 || id === 7) {
        blocks[i][j] = 0;
        var pwr;
        switch (id) {
          case 4:
            pwr = 1;
            break;
          case 6:
            pwr = 2;
            break;
          case 7:
            pwr = 3;
            break;
          default:
            break;
        }
        triggers.push({
          x: 50 * j + 10,
          y: 50 * i + 10,
          width: 30,
          height: 30,
          type: "JumpSquare",
          power: pwr,
          cooldown: 0,
          color: triggerFills.JumpSquare[pwr],
        });
      }
    }
  }
}
function checkSquareCollide(xCheck, yCheck, wCheck, hCheck, verbose=false) {
  var y1 = yCheck
  var y2 = yCheck + hCheck - 1
  var x1 = xCheck
  var x2 = xCheck + wCheck - 1
  var finalX = x1;
  var finalY = y1;
  var maxVal = 0;
  var vals = [];
  for (var i=y1; i<y2+50; i+=50) {
    if (i > y2) {
      i = y2;
    }
    for (var j=x1; j<x2+50; j+=50) {
      if (j > x2) {
        j = x2;
      }
      vals.push([checkCollide(j, i),i,j]);
    }
  }  
  for (var i=0; i<vals.length; i++) {
    var newBlock = BLOCK_PRIORITY.indexOf(vals[i][0]);
    if (newBlock > maxVal) {
      maxVal = newBlock;
      finalY = vals[i][1];
      finalX = vals[i][2];
    }
  }
  if (verbose) {
    return {
      block: BLOCK_PRIORITY[maxVal],
      x: Math.floor(finalX/50),
      y: Math.floor(finalY/50)
    };
  }
  return BLOCK_PRIORITY[maxVal];
}
function checkCollide(xCheck, yCheck) {
  i = Math.floor(yCheck / 50)
  j = Math.floor(xCheck / 50)
  if (i < 0 || j < 0 || i >= blocks.length || j >= blocks[i].length) {
    return 1;
  }
  return blocks[i][j];
}
function jump() {
  dy = -1 * JUMP_HEIGHT;
  if (heldKeys.has("KeyD") || heldKeys.has("ArrowRight")) {
    if (dx < 0) {
      dx *= -0.5;
    }
    dx += MOVE_SPEED * GROUND_FRICTION;
  }
  if (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft")) {
    if (dx > 0) {
      dx *= -0.5;
    }
    dx -= MOVE_SPEED * GROUND_FRICTION;
  }
}
function draw() {
  switch (menu) {
    case 1:
      game();
      break;
    case 2:
      levelSelect();
      break;
    default:
      ctx.fillStyle = "rgb(0,0,0)";
      ctx.fillRect(0,0,600,600);
      break;
  }
  
  //Repeat
  setTimeout(draw, 16);
}
function levelSelect() {
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.fillRect(0,0,600,600);
  ctx.font = "48px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillText("Level Select",300,70);
  ctx.font = "18px monospace";
  ctx.fillStyle = "rgb(127,127,127)";
  ctx.fillText("Select Level: WASD   Enter Level: L      ",300,105);
  for (var i=0; i<=bestLevel+1; i++) {
    var cornerX = (i%6) * 100 + 25;
    var cornerY = Math.floor(i/6) * 100 + 125;
    if (i > bestLevel) {
      cornerX = 525;
      cornerY = 525;
    }
    ctx.fillStyle = "rgb(0,0,0)";
    if (i === cursorLevel) {
      ctx.fillStyle = "rgb(200,200,200)";
    }
    ctx.fillRect(cornerX, cornerY, 50, 50);
    ctx.fillStyle = "rgb(127,255,191)";
    if (i === bestLevel) {
      ctx.fillStyle = "rgb(255,255,127)";
    } else if (i > bestLevel) {
      ctx.fillStyle = "rgb(200,100,255)";
    }
    if (i === level) {
      ctx.fillStyle = "rgb(159,201,255)";
    }
    ctx.fillRect(cornerX+5,cornerY+5,40,40);
    ctx.fillStyle = "rgb(10,10,10)";
    if (i === cursorLevel) {
      ctx.fillStyle = "rgb(150,150,150)";
    }
    ctx.font = "24px monospace";
    if (i > bestLevel) {
      ctx.font = "32px monospace";
      ctx.fillText("*", cornerX+25, cornerY+42);
    } else {
      ctx.fillText(i+1, cornerX+25, cornerY+32);
    }
  }
}
function game() {
  //Update cooldowns
  if (coyoteFrames > 0) {
    coyoteFrames--;
  }
  if (jumpBufferFrames > 0) {
    jumpBufferFrames--;
  }
  for (var i=0; i<triggers.length; i++) {
    if ("cooldown" in triggers[i] && triggers[i].cooldown > 0) {
      triggers[i].cooldown--;
    }
  }
  
  //Listen to keypresses
  if (heldKeys.has("KeyD") || heldKeys.has("ArrowRight")) {
    dx+=MOVE_SPEED * curFriction;
  }
  if (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft")) {
    dx-=MOVE_SPEED * curFriction;
  }
  if (heldKeys.has("KeyW") || heldKeys.has("ArrowUp")) {
    if (!jumpHeld) {
      jumpHeld = true;
      if (coyoteFrames > 0 ) {
        jump();
        coyoteFrames = 0;
      } else if (jumpsLeft > 0 &&
            (dy <= 0 ||
              !SOLID_BLOCKS.has(checkSquareCollide(4*dx+x, 4*dy+y, width, height)) ||
              SOLID_BLOCKS.has(checkSquareCollide(4*dx+x, y, width, height))
            )
          ) {
        jump();
        jumpsLeft--;
      } else {
        jumpBufferFrames = 4;
      }
    }
  } else {
    jumpHeld = false;
  }
  if (heldKeys.has("KeyS") || heldKeys.has("ArrowDown")) {
    //Down
  }
  
  // Update move friction
  if (curFriction === GROUND_FRICTION && coyoteFrames === 0) {
    curFriction = AIR_FRICTION;
  }
  
  //Move player
  x += dx;
  if (SOLID_BLOCKS.has(checkSquareCollide(x, y, width, height))) {
    if (dx > 0) {
      x = Math.floor((x+width)/50)*50 - width
    } else {
      x = Math.ceil((x)/50)*50
    }
    dx = 0;
  }
  dx *= (1 - curFriction);
  
  var preMoveCollideBlock = checkSquareCollide(x, y, width, height);
  var startY = y;
  for (var curDy = 50; curDy < Math.abs(dy) + 50; curDy += 50) {
    if (curDy > Math.abs(dy)) {
      curDy = Math.abs(dy);
    }
    y = startY + curDy;
    if (dy < 0) {
      y = startY - curDy;
    }
    var collideBlock = checkSquareCollide(x, y, width, height);
    if (SOLID_BLOCKS.has(collideBlock) || (dy > 0 && collideBlock === 5 && preMoveCollideBlock !== 5)) {
      if (dy > 0) {
        y = Math.floor((y+height)/50)*50 - height
        if (jumpBufferFrames > 0) {
          jump();
          jumpBufferFrames = 0;
        } else {
          coyoteFrames = 6;
          curFriction = AIR_FRICTION;
          if (collideBlock !== 3) {
            curFriction = GROUND_FRICTION;
          }
        }
        if (collideBlock !== 3) {
          if (jumpsLeft < groundJumps) {
            jumpsLeft = groundJumps;
          }
        }
      } else {
        y = Math.ceil((y)/50)*50
      }
      if (dy != -1 * JUMP_HEIGHT) {
        dy = 0;
      }
      break;
    }
  }
  dy++;
    
  //Interact with blocks
  var interaction = checkSquareCollide(x, y, width, height, true);
  switch (interaction.block) {
    case 2:
      if (level > bestLevel) {
        menu = 2;
        currentLevel = level;
        break;
      }
      level++;
      if (level > bestLevel) {
        bestLevel = level;
        localStorage.setItem("level", ""+bestLevel);
      }
      setup();
      break;
    case 8:
      dy++;
      break;
    case 9:
      dy-=2;
      break;
    case 10:
      dy--;
      break;
  }
  
  //Interact with triggers
  var cameraShiftX = 0;
  var cameraShiftY = 0;
  var cameraMinX = 0;
  var cameraMinY = 0;
  var cameraMaxX = blocks[0].length*50 - 600;
  var cameraMaxY = blocks.length*50 - 600;
  for (i=0; i<triggers.length; i++) {
    var t = triggers[i];
    if (x + width > t.x && x < t.x + t.width && y + height > t.y && y < t.y + t.height) {
      if (!('cooldown' in t) || t.cooldown === 0) {
        switch (t.type) {
          case "JumpSquare":
            if (jumpsLeft < t.power) {
              jumpsLeft = t.power;
              t.cooldown = 100;
            }
            break;
          case "ToolkitChange":
            if ('groundJumps' in t) {
              groundJumps = t.groundJumps;
              if (jumpsLeft < groundJumps || 'forceJumps' in t) {
                jumpsLeft = groundJumps;
              }
            }
            if ('playerWidth' in t) {
              x -= (t.playerWidth - width) / 2;
              width = t.playerWidth;
            }
            if ('playerHeight' in t) {
              y -= t.playerHeight - height;
              height = t.playerHeight;
            }
            break;
          case "Camera":
            if ('shiftX' in t) {
              cameraShiftX = t.shiftX;
            }
            if ('shiftY' in t) {
              cameraShiftY = t.shiftY;
            }
            if ('minX' in t) {
              cameraMinX = Math.max(cameraMinX, t.minX);
            }
            if ('maxX' in t) {
              cameraMaxX = Math.min(cameraMaxX, t.maxX - 600);
            }
            if ('minY' in t) {
              cameraMinY = Math.max(cameraMinY, t.minY);
            }
            if ('maxY' in t) {
              cameraMaxY = Math.min(cameraMaxY, t.maxY - 600);
            }
            break;
          default:
            break;
        }
      }
    }
  }
  
  //Find camera loc
  var totalScrollDx = (scrollDx * Math.abs(scrollDx) + scrollDx) / 2;
  if (scrollX + totalScrollDx < cameraShiftX) {
    scrollDx ++;
  }
  if (scrollX + totalScrollDx > cameraShiftX) {
    scrollDx --;
  }
  scrollX += scrollDx;
  var totalScrollDy = (scrollDy * Math.abs(scrollDy) + scrollDy) / 2;
  if (scrollY + totalScrollDy < cameraShiftY) {
    scrollDy ++;
  }
  if (scrollY + totalScrollDy > cameraShiftY) {
    scrollDy --;
  }
  scrollY += scrollDy;
  var totalMinDx = (minCamDx * Math.abs(minCamDx) + minCamDx) / 2;
  if (minCamX + totalMinDx < cameraMinX) {
    minCamDx ++;
    if (minCamX < cameraMinX) {
      // if max / min sets, set dx to 0
      minCamX = Math.max(minCamX,Math.min(cameraMaxX, finalCameraX));
    }
  }
  if (minCamX + totalMinDx > cameraMinX) {
    minCamDx --;
    if (minCamX > cameraMinX) {
      minCamX = Math.min(minCamX,Math.max(cameraMaxX, finalCameraX));
    }
  }
  minCamX += minCamDx;
  var totalMaxDx = (maxCamDx * Math.abs(maxCamDx) + maxCamDx) / 2;
  if (maxCamX + totalMaxDx < cameraMaxX) {
    maxCamDx ++;
    if (maxCamX < cameraMaxX) {
      maxCamX = Math.max(maxCamX,Math.min(cameraMaxX, finalCameraX));
    }
  }
  if (maxCamX + totalMaxDx > cameraMaxX) {
    maxCamDx --;
    if (maxCamX > cameraMaxX) {
      maxCamX = Math.min(maxCamX,Math.max(cameraMaxX, finalCameraX));
    }
  }
  maxCamX += maxCamDx;
  var totalMinDy = (minCamDy * Math.abs(minCamDy) + minCamDy) / 2;
  if (minCamY + totalMinDy < cameraMinY) {
    minCamDy ++;
    if (minCamY < cameraMinY) {
      minCamY = Math.max(minCamY,Math.min(cameraMaxY, finalCameraY));
    }
  }
  if (minCamY + totalMinDy > cameraMinY) {
    minCamDy --;
    if (minCamY > cameraMinY) {
      minCamY = Math.min(minCamY,Math.max(cameraMaxY, finalCameraY));
    }
  }
  minCamY += minCamDy;
  var totalMaxDy = (maxCamDy * Math.abs(maxCamDy) + maxCamDy) / 2;
  if (maxCamY + totalMaxDy < cameraMaxY) {
    maxCamDy ++;
    if (maxCamY < cameraMaxY) {
      maxCamY = Math.max(maxCamY,Math.min(cameraMaxY, finalCameraY));
    }
  }
  if (maxCamY + totalMaxDy > cameraMaxY) {
    maxCamDy --;
    if (maxCamY > cameraMaxY) {
      maxCamY = Math.min(maxCamY,Math.max(cameraMaxY, finalCameraY));
    }
  }
  maxCamY += maxCamDy;
  
  finalCameraX = Math.round(Math.min(Math.max(x+(width/2)-300+scrollX,minCamX,0),maxCamX,blocks[0].length*50-600));
  finalCameraY = Math.round(Math.min(Math.max(y+ height  -300+scrollY,minCamY,0),maxCamY,blocks.length*50-600));
  
  //Draw board
  for (var i=Math.floor(finalCameraY/50); i<Math.ceil(finalCameraY/50)+12; i++) {
    for (var j=Math.floor(finalCameraX/50); j<Math.ceil(finalCameraX/50)+12; j++) {
      var block = 1;
      if (i >= 0 && i < blocks.length && j >= 0 && j < blocks[i].length) {
        block = blocks[i][j];
      }
      var blockSize = blockSizes[block];
      if (blockSize < 50) {
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillRect(j*50-finalCameraX, i*50-finalCameraY, 50, 50);
      }
      ctx.fillStyle = blockFills[block];
      ctx.fillRect(j*50-finalCameraX + (50-blockSize) / 2,i*50-finalCameraY + (50-blockSize) / 2,blockSize, blockSize);
    }
  }
  
  //Draw triggers
  for (i=0; i<triggers.length; i++) {
    var t = triggers[i];
    if ("color" in t) {
      ctx.fillStyle = t.color;
      if ("cooldown" in t && t.cooldown !== 0) {
        ctx.fillStyle = "rgb(191,191,191)";
      }
      ctx.fillRect(t.x - finalCameraX, t.y-finalCameraY, t.width, t.height);
    }
  }
  
  
  //Draw text
  if (level <= bestLevel) {
  ctx.textAlign = "left";
    if (level === 0) {
      ctx.fillStyle = "rgb(150, 150, 150)";
      ctx.font = "24px monospace";
      ctx.fillText("W", 143-finalCameraX, 420-finalCameraY);
      ctx.fillText("A S D", 114-finalCameraX, 450-finalCameraY);
      ctx.font = "18px monospace"
      ctx.fillText("Your motion can't", 607-finalCameraX, 330-finalCameraY);
      ctx.fillText("be controlled in", 612-finalCameraX, 353-finalCameraY);
      ctx.fillText("the air, except by", 602-finalCameraX, 376-finalCameraY);
      ctx.fillText("your directional", 612-finalCameraX, 399-finalCameraY);
      ctx.fillText("double jump.", 640-finalCameraX, 422-finalCameraY);
      ctx.fillText("Jump carfully.", 628-finalCameraX, 460-finalCameraY);
      ctx.font = "18px monospace"
      ctx.fillText("Most things in this game are left to be discovered by", 109-finalCameraX, 120-finalCameraY);
      ctx.fillText("yourself. Make experiments, and don't be afraid to fall:", 98-finalCameraX, 140-finalCameraY);
      ctx.fillText("You will do so often.", 282-finalCameraX, 160-finalCameraY);
    } else if (level === 1) {
      ctx.fillStyle = "rgb(150, 150, 150)";
      ctx.font = "24px monospace";
      ctx.textAlign = "center";
      ctx.fillText("L", 150-finalCameraX, 1130-finalCameraY);
      ctx.font = "16px monospace";
      ctx.fillText("Open Level", 150-finalCameraX, 1150-finalCameraY);
      ctx.fillText("Select", 150-finalCameraX, 1165-finalCameraY);
    } else if (level === 5) {
      ctx.fillStyle = "rgb(130, 130, 130)";
      ctx.font = "16px monospace";
      ctx.fillText("Minor note about semisolids:", 55-finalCameraX, 320-finalCameraY);
      ctx.fillText("You can only stand on top of", 55-finalCameraX, 350-finalCameraY);
      ctx.fillText("a semisolid if you aren't", 55-finalCameraX, 370-finalCameraY);
      ctx.fillText("currently inside (or partly", 55-finalCameraX, 390-finalCameraY);
      ctx.fillText("inside) of one.", 55-finalCameraX, 410-finalCameraY);
    }
  }
  
  //Draw player
  ctx.fillStyle = "rgb(63,63,63)";
  ctx.fillStyle = playerFills[jumpsLeft]
  ctx.fillRect(x-finalCameraX,y-finalCameraY,width,height)
}
document.addEventListener('keydown', e => {
  heldKeys.add(e.code);
  if (e.code === "KeyL") {
    if (menu === 1) {
      cursorLevel = level;
      menu = 2;
    } else if (menu === 2) {
      level = cursorLevel;
      setup();
    }
  }
  if (menu === 2) {
    if (e.code === "KeyD" || e.code === "ArrowRight") {
      cursorLevel++;
      if (cursorLevel > bestLevel) {
        cursorLevel = bestLevel+1;
      }
    } else if (e.code === "KeyA" || e.code === "ArrowLeft") {
      cursorLevel--;
      if (cursorLevel < 0) {
        cursorLevel = 0;
      }
    } else if (e.code === "KeyS" || e.code === "ArrowDown") {
      cursorLevel+=6;
      if (cursorLevel > bestLevel) {
        cursorLevel = bestLevel+1;
      }
    } else if (e.code === "KeyW" || e.code === "ArrowUp") {
      if (cursorLevel > bestLevel) {
        cursorLevel = bestLevel + 6;
      }
      cursorLevel-=6;
      if (cursorLevel < 0) {
        cursorLevel = 0;
      }
    }
  }
});
document.addEventListener('keyup', e => {
  heldKeys.delete(e.code);
});
draw()
