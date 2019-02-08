#ifndef FORKEDCOMPOSER_H_1CFABC12
#define FORKEDCOMPOSER_H_1CFABC12

#include "Composer.h"

#include <signal.h>
#include <stdexcept>

typedef std::function<void(Output_t)> Callback_t;

// global is declared ONLY on child fork
extern Composer* gForkedComposer;

void ForkTerminationHandler(int signal);

template<class C>
class ForkedComposer : public Composer{
public:

  ForkedComposer() : _is_child(false), _pid(0) 
  {  
      std::cout <<"ForkedComposer ctor " << typeid(*this).name() <<std::endl;
  }
 
  ~ForkedComposer() 
  {        
    std::cout <<"ForkedComposer dtor " << typeid(*this).name() << (_is_child?"child":"parent") << std::endl;

    if(_pid) { 
      // A child process exists. Nuke it.
      std::cout << "Composer " << m_id << " is destructing; killing process " << _pid << std::endl;
      close(_input_pipe[0]);
      close(_output_pipe[0]);
      close(_output_pipe[1]);
      kill(_pid, SIGINT);
    }
    if(_is_child) {
      std::cout << "Composer " << m_id << " is killed. Closing pipes." << std::endl;
      
      close(_input_pipe[0]);
      close(_input_pipe[1]);
      close(_output_pipe[0]);
      close(_output_pipe[1]);
    }
  }
    
    
  virtual void configure(Config_t config, int id=0) {
    Composer::configure(config,id);
    // Called exactly once.
    // Set up I/O pipes.
    if(pipe(_input_pipe)==-1) throw std::runtime_error("Couldn't open input pipe.");
    if(pipe(_output_pipe)==-1) throw std::runtime_error("Couldn't open output pipe.");
    // Fork.
    _pid = fork();
    if(_pid < 0) throw std::runtime_error("Couldn't fork.");
    if( _pid == 0) {
      _is_child = true; // We are the child process.
      gForkedComposer = this;
      signal (SIGINT,   ForkTerminationHandler);
      signal (SIGHUP,   ForkTerminationHandler);
      signal (SIGTERM,  ForkTerminationHandler);
      signal ( SIGBUS,  ForkTerminationHandler);
      signal ( SIGSEGV, ForkTerminationHandler);
      signal ( SIGILL,  ForkTerminationHandler);
      signal ( SIGFPE,  ForkTerminationHandler);
      
      std::string dir = m_config->value("fork_logdir",".");
      std::string logfilename = dir + "/argo_backend_" + std::to_string(m_id) + ".log";
      std::string errfilename = dir + "/argo_backend_" + std::to_string(m_id) + ".err";

      freopen(logfilename.c_str(),"w",stdout);
      freopen(errfilename.c_str(),"w",stderr);
      std::cout << "ForkedComposer child running " << std::endl;
      
      _composer = std::shared_ptr<C>(new C);
      _composer->configure(m_config,m_id); // Important: our child has the same ID as us.
      _composer->initialize();
      _composer->set_output_callback([this](OutputType_t t, Output_t o){pass_output(t,o);});
      close(_input_pipe[1]); // No writing to input pipe
      while(true) {
        Output_t request_str;
        OutputType_t type;
        read_from_pipe(_input_pipe,type,request_str);
        Request_t req(new nlohmann::json);
        *req = nlohmann::json::parse(*request_str);
        std::cout << "Doing request " << req->dump(2) << std::endl;
        try{
          Output_t result = _composer->satisfy_request(req);          
          write_to_pipe(_output_pipe,kRetval,*result);
        } catch (std::exception& e) {
          std::string s=std::string("{\"error\":\"Exception caught in Forked Composer: ") + e.what() + "\"}";
          write_to_pipe(_output_pipe,kRetval|kError,s);
        }
      }

    } else {
      _is_child = false;
      close(_input_pipe[0]); // No reading from input pipe
      // get ready to rumble.
    }
    
  }


  virtual bool can_satisfy(Request_t r) { 
    return true; // Stupid
      // FIXME: may need to check to see if busy.
  };
  
  virtual Output_t satisfy_request(Request_t r) { 
    // Only called of the parent.
    if(_is_child) return Output_t();
    
    std::string request_str = r->dump();
    write_to_pipe(_input_pipe, kRequest, request_str);

    // blocking.
    while(true) {
      Output_t      output;
      OutputType_t  type;
      read_from_pipe(_output_pipe, type, output);
      if((type & kRetval)==kRetval) {
        return output;
      } 
      if(m_output_callback) {
        m_output_callback(type,output);
      }
    }
  }
  
private:
  
  
  // Called in client thread by Composer: 
  void pass_output(OutputType_t type, Output_t output) {
    if(output) write_to_pipe(_output_pipe,type,*output);
  }
  
  void read_from_pipe(int pipe[], OutputType_t &type, Output_t& output)
  {
    size_t size = 0;
    int retval;
    retval = read(pipe[0], &type, sizeof(OutputType_t));  if(retval<0) throw std::runtime_error("pipe read error");
    retval = read(pipe[0], &size, sizeof(size_t));        if(retval<0) throw std::runtime_error("pipe read error");
    
    output = Output_t(new std::string(size,0));
    size_t got = 0;
    while(got<size) {
      retval = read(pipe[0], &(*output)[got], size-got ); 
      if(retval<0) throw std::runtime_error("pipe read error");
      got += retval;
    }
    std::cout << _pid << " READ FROM PIPE TYPE " << to_string(type) << " SIZE " << size << std::endl;
    std::cout << _pid << " READ FROM PIPE " << output->substr(0,50) << " " << output->size() << std::endl;
  }
  
  void write_to_pipe(int pipe[], OutputType_t type, const std::string& str)
  {
    size_t size = str.size();
    std::cout << _pid << " WRITE TO PIPE TYPE " << to_string(type) << " SIZE " << size << std::endl;
    write(pipe[1], &type, sizeof(OutputType_t));
    write(pipe[1], &size, sizeof(size_t));
    write(pipe[1], &str[0], size);
  }
  
  std::shared_ptr<C> _composer;
  bool               _is_child;
  pid_t              _pid;
  int                _input_pipe[2];
  int                _output_pipe[2];
  int                _progress_pipe[2];
};




#endif /* end of include guard: FORKEDCOMPOSER_H_1CFABC12 */
