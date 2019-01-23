#ifndef FORKEDCOMPOSER_H_1CFABC12
#define FORKEDCOMPOSER_H_1CFABC12

#include "Composer.h"

#include <signal.h>
#include <stdexcept>

typedef std::function<void(Output_t)> Callback_t;

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
      close(_input_pipe[0]);
      close(_output_pipe[0]);
      close(_output_pipe[1]);
      kill(_pid, SIGKILL);
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
      _composer = std::shared_ptr<C>(new C);
      _composer->configure(m_config,m_id); // Important: our child has the same ID as us.
      _composer->initialize();
      close(_input_pipe[1]); // No writing to input pipe
      while(true) {
        Output_t request_str = read_from_pipe(_input_pipe);
        Request_t req(new nlohmann::json);
        *req = nlohmann::json::parse(*request_str);
        std::cout << "Doing request " << req->dump(2) << std::endl;
        Output_t result = _composer->satisfy_request(req);
        write_to_pipe(_output_pipe,*result);
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
    write_to_pipe(_input_pipe, request_str);
    // blocking.
    return read_from_pipe(_output_pipe);
  }
  
private:
  Output_t read_from_pipe(int pipe[])
  {
    size_t size = 0;
    read(pipe[0], &size, sizeof(size_t));
    
    Output_t output(new std::string(size,0));
    size_t got = 0;
    while(got<size) {
      got += read(pipe[0], &(*output)[got], size-got );      
    }
    std::cout << _pid << " READ FROM PIPE SIZE " << size << std::endl;
    std::cout << _pid << " READ FROM PIPE " << output->substr(0,50) << std::endl;
    
    return output;
  }
  
  void       write_to_pipe(int pipe[], const std::string& str)
  {
    size_t size = str.size();
    std::cout << _pid << " WRITE TO PIPE SIZE " << size << std::endl;
    write(pipe[1], &size, sizeof(size_t));
    write(pipe[1], &str[0], size);
  }
  
  std::shared_ptr<C> _composer;
  bool               _is_child;
  pid_t              _pid;
  int                _input_pipe[2];
  int                _output_pipe[2];
};



#endif /* end of include guard: FORKEDCOMPOSER_H_1CFABC12 */
