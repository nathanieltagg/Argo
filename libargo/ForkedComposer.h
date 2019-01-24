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
  }
 
  ~ForkedComposer() 
  {  
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
    
    
  virtual void initialize() {
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
      
      std::string dir = (*m_config)["fork_logs"].template get<std::string>();
      std::string logfilename = dir + "argo_backend_" + std::to_string(m_id) + ".log";
      std::string errfilename = dir + "argo_backend_" + std::to_string(m_id) + ".err";

      freopen(logfilename.c_str(),"w",stdout);
      freopen(errfilename.c_str(),"a",stderr);
      
      _composer = std::shared_ptr<C>(new C);
      _composer->configure(m_config,m_id); // Important: our child has the same ID as us.
      _composer->initialize();
      _composer->set_progress_callback([this](float f, const std::string& s){pass_progress(f,s);});
      close(_input_pipe[1]); // No writing to input pipe
      while(true) {
        Output_t request_str;
        int type;
        read_from_pipe(_input_pipe,type,request_str);
        Request_t req(new nlohmann::json);
        *req = nlohmann::json::parse(*request_str);
        std::cout << "Doing request " << req->dump(2) << std::endl;
        try{
          Output_t result = _composer->satisfy_request(req);
          write_to_pipe(_output_pipe,kResult,*result);
        } catch (std::exception& e) {
          std::string s=std::string("{\"error\":\"Exception caught in Forked Composer: ") + e.what() + "\"}";
          write_to_pipe(_output_pipe,kResult,s);
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
      Output_t output;
      int      type;
      read_from_pipe(_output_pipe, type, output);
      if(type==kProgress && output) {
        nlohmann::json j = nlohmann::json::parse(*output);
         if(m_progress_callback) m_progress_callback(j["f"],j["s"]);
      } else {
        return output;
      }
    }
  }
  
private:
  
  
  void pass_progress(float f,const std::string& s) {
    // Called in client thread by Composer. 
    nlohmann::json j;
    j["f"] = f;
    j["s"] = s;
    write_to_pipe(_output_pipe,kProgress,j.dump());
  }
  
  void read_from_pipe(int pipe[], int &type, Output_t& output)
  {
    size_t size = 0;
    int retval;
    retval = read(pipe[0], &size, sizeof(size_t));    if(retval<0) throw std::runtime_error("pipe read error");
    retval = read(pipe[0], &type, sizeof(int));       if(retval<0) throw std::runtime_error("pipe read error");
    
    output = Output_t(new std::string(size,0));
    size_t got = 0;
    while(got<size) {
      retval = read(pipe[0], &(*output)[got], size-got ); 
      if(retval<0) throw std::runtime_error("pipe read error");
      got += retval;
    }
    std::cout << _pid << " READ FROM PIPE SIZE " << size << std::endl;
    std::cout << _pid << " READ FROM PIPE " << output->substr(0,50) << std::endl;
  }
  
  void write_to_pipe(int pipe[], int type, const std::string& str)
  {
    size_t size = str.size();
    std::cout << _pid << " WRITE TO PIPE SIZE " << size << std::endl;
    write(pipe[1], &size, sizeof(size_t));
    write(pipe[1], &type, sizeof(int));
    write(pipe[1], &str[0], size);
  }
  
  typedef enum { kRequest = 0, kResult = 1, kProgress = 2} MessageType_t;
  std::shared_ptr<C> _composer;
  bool               _is_child;
  pid_t              _pid;
  int                _input_pipe[2];
  int                _output_pipe[2];
  int                _progress_pipe[2];
};




#endif /* end of include guard: FORKEDCOMPOSER_H_1CFABC12 */
