const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();

function Wizard(callback){
  databases = [];

  function addDbs(cb){
    let p = inquirer.createPromptModule();
    return p([
      {
        type: 'input',
        name: 'database.path',
        message: 'mongodb path to your database'
      },
      {
        type: 'input',
        name: 'database.alias',
        message: 'Alias used to reference internally (ie \'development\')'
      },
      {
        type: 'confirm',
        name: 'database.new',
        message: 'Would you like to add another database?',
        default: true
      }
    ]).then(function(answers){

      databases.push({
        name: answers['database.alias'],
        url: answers['database.path']
      });

      if(answers['database.new']){
        return addDbs(cb);
      } else {
        return cb()
      }

    });

  }

  addDbs(function(){

    this.aws_questions = [
      {
        type: 'confirm',
        name: 'aws',
        message: 'Would you like to link an AWS S3 bucket for backups?',
      },
      {
        type: 'input',
        name: 'aws.bucket',
        message: 'Amazon S3 Bucket name',
        when: function(answers){
          return answers.aws
        }
      },
      {
        type: 'input',
        name: 'aws.secret',
        message: 'Amazon S3 SECRET key',
        when: function(answers){
          return answers.aws
        }
      },
      {
        type: 'input',
        name: 'aws.access',
        message: 'Amazon S3 ACCESS key',
        when: function(answers){
          return answers.aws
        }
      }
    ];

    this.import_questions = [
      {
        type: 'list',
        name: 'restore.source',
        message: 'Default \'import\' source (import from this datasource)',
        choices: function(){
          let import_options = Object.keys(CONFIG.databases);
          if(CONFIG.aws) import_options.unshift('S3');
          return import_options;
        }
      },
      {
        type: 'list',
        name: 'restore.destination',
        message: 'Default \'import\' destination (import from a datasource to this database)',
        choices: function(answers){
          let import_options = Object.keys(CONFIG.databases);
          return import_options.filter(function(val){
            return val !== answers['restore.source'];
          });
        }
      }
    ];

    this.export_questions = [
      {
        type: 'list',
        name: 'dump.source',
        message: 'Default \'export\' source (export from here to somewhere else)',
        choices: function(){
          let export_options = Object.keys(CONFIG.databases);
          return export_options;
        }
      },
      {
        type: 'list',
        name: 'dump.destination',
        message: 'Default \'export\' destination (exported data will be sent here)',
        choices: function(answers){
          let export_options = Object.keys(CONFIG.databases);
          if(CONFIG.aws) export_options.unshift('S3');
          return export_options.filter(function(val){
            return val !== answers['restore.source'];
          });
        }
      }
    ];

    return callback(databases, inquirer);

  });

}

module.exports = Wizard;
