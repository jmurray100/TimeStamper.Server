//var http = require('http');
//var fs = require('fs');
const Stampery = require('stampery');
var express = require('express');
var bodyParser = require('body-parser');
var fileUpload = require("express-fileupload");
var crypto = require('crypto');
var cors = require('cors');
var app = express();
app.use(cors());
app.use(bodyParser.json({ type: 'application/json' }));
// default options
app.use(fileUpload());


// API key
var stampery = new Stampery(Copy_Your_API_Key_Here);

const APIPort = 3000;


app.post('/', function(req, res){
    console.log('Server Recevie New Connection...');
    var ReadyToSend = GenOutPacket("Finish","Welcome to Stamper!","");
    return res.status(200).json(ReadyToSend);
});

//Stamp Files Function
app.post('/stamp', function (req, res) {
  console.log("Received File Stamp Request From Client...");
  if (req.files == null) {
    console.log("No files were uploaded.");
    var ReadyToSend = GenOutPacket("Error","No files were uploaded.","")
    return res.status(400).json(ReadyToSend);
  }
  if (typeof req.files.sampleFile ==="undefined"){
    console.log("No Data in the file");
    var ReadyToSend = GenOutPacket("Error","No data in the file.", "");
    return res.status(400).json(ReadyToSend);
  }
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.sampleFile;
  
  //Stamping workflow
  const hash = stampery.hash(sampleFile.data);
  console.log('Successfully hash filedata');

  console.log('Creating New stamp...');
  // Stamping workflow without WebHook
  stampery.stamp(hash).then((stamp) => {
    console.log("Opperation successful: File ID: "+stamp.id +"has been stamped with hash: "+ stamp.hash);
    console.log("Done.");
    var ReadyToSend = GenOutPacket("Finish","The file is stamped Successfully",stamp)
    return res.status(200).json(ReadyToSend);
  }).catch((err) => {
    if(err.statusCode == 409){
      console.log("Fail to stamp the file");
      console.log("Operation Terminated");
      var ReadyToSend = GenOutPacket("Error","This file did't finish all the confirmation. Please try to submit other file or wait until",{"StampID":err.error.result.id,"StampTime":err.error.result.time});
      return res.status(400).json(ReadyToSend);
    }
    console.log(err);
    var ReadyToSend = GenOutPacket("Error","There are some error occur during stamping... Please Try it later",err);
    return res.status(400).json(ReadyToSend);
  });

});

//Search By ID Function
app.post('/search', function (req, res) {
  console.log("Received SearchByID Request From Client...");
  if (req.body.searchID == null || req.body.searchID =="") {
    console.log("No Data within the request");
    return res.status(400).json({"Status":"Error","Message":"No Data within the request"});
  }
  console.log("Searching with ID ...");

  stampery.getById(String(req.body.searchID)).then((stamp) => {
    if(stamp.length > 0){
      console.log('This ID is valid. Returning Result...');
      console.log ('Done');
      var ReadyToSend = GenOutPacket("Finish","Successfully Search By ID",stamp[0])
      return res.status(200).json(ReadyToSend);
    }
    else{
      var ReadyToSend = GenOutPacket("Error","No Data with this ID","")
      return res.status(400).json(ReadyToSend);
    }
  }).catch((err) => {
      console.error(err);
      var ReadyToSend = GenOutPacket("Error","The ID Formate May Not be True, Pleace Try again later.","")
      return res.status(400).json(ReadyToSend);
  });
});

/** Get all Stamps info related to the files*/
app.post('/getStamps', function (req, res) {
  console.log("Received Check File Stamp Request From Client...");
  if (req.files == null) {
    console.log("No files were uploaded.");
    var ReadyToSend = GenOutPacket("Error","No files were uploaded.", "");
    return res.status(400).json(ReadyToSend);
  }
  console.log(req.files.sampleFile);
  if (typeof req.files.sampleFile ==="undefined"){
    console.log("No Data in the file");
    var ReadyToSend = GenOutPacket("Error","No data in the file.", "");
    return res.status(400).json(ReadyToSend);
  }
  console.log("Files were uploaded.");
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.sampleFile;
  console.log("Hashing Files...");
  const hash = stampery.hash(sampleFile.data);
  console.log("Done.");
  console.log("Searching with the file hash...");
  stampery.getByHash(hash).then((stampsList) => {
      if(stampsList.length >0){
        console.log("File Found !");
        var ReadyToSend = GenOutPacket("Finish","Finish to Verify the File", stampsList);
        return res.status(200).json(ReadyToSend);
      }
      else {
        console.log("File Not Found");
        var ReadyToSend = GenOutPacket("Finish","No related Stamps for the file. Please submit other file to the System","");
        return res.status(400).json(ReadyToSend);
      }
  }).catch((err) => {
      console.error(err);
      var ReadyToSend = GenOutPacket("Error","There are some error occur, Please Try again later.","")
      return res.status(400).json(ReadyToSend);
  });
});

function GenOutPacket(Status,Message,Data){
  const dateTime = Date.now();
  var ReadyToSend = {
    "Time": dateTime,
    "Status": Status,
    "Message":Message,
    "Data":Data
  };
  return ReadyToSend;
}

app.post('/proofRoot', function (req, res) {
  console.log("Received Proof MerkleRoot Request From Client...");
  var Filehash = req.body.Filehash;
  var mP = JSON.parse(req.body.proof);
  var TempHash;
  var StepHash = [];
  console.log("Calculating to the Merkle Tree...");
  for (var i = 0; i < mP.length;i++){
      if (mP[i].left != null){
          if (i == 0){
              TempHash = SHA256(mP[i].left+Filehash);
          }
          else {
              TempHash = SHA256(mP[i].left+TempHash);
          }
          StepHash.push(TempHash);
      }
      else if (mP[i].right != null){
          if (i == 0){
              TempHash = SHA256(Filehash+mP[i].right);
          }
          else {
              TempHash = SHA256(TempHash+mP[i].right);
          }
          StepHash.push(TempHash);
      }
  }
  console.log("Done.");
  var result = TempHash.toUpperCase();
  var SendData = {"hash":Filehash, "result": result, "step": StepHash};
  console.log("Returning the result to client...");
  if (req.body["MerkleRoot"]!= undefined){
    var SendData = {"hash":Filehash, "result": result, "step": StepHash, "match": result==req.body.MerkleRoot};
  }
  var ReadyToSend = GenOutPacket("Finish","Finish to Proof the MerkleRoot", SendData);
  return res.status(200).json(ReadyToSend);
});


function SHA256(x) {
  var buf = new Buffer(x, 'hex');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

var server = app.listen(APIPort, function () {
  var port = server.address().port;
  console.log("RESTful API listening at http://localhost:"+ port);
})

