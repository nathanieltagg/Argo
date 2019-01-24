#ifndef WRAPPEDFACTORY_H_F458F326
#define WRAPPEDFACTORY_H_F458F326
#include <nan.h>
#include "ComposerFactory.h"
namespace argo {
  

  class Factory : public Nan::ObjectWrap, public ComposerFactory {
   public:
    static NAN_MODULE_INIT(Init);

    static NAN_METHOD(New); //void New(const v8::FunctionCallbackInfo<v8::Value>& args);

   private:
    explicit Factory(const std::string& config);
    ~Factory();

    static NAN_METHOD(composeSync);
    static NAN_METHOD(composeAsync); // Async
    static NAN_METHOD(composeWithProgress); // Async
    static Nan::Persistent<v8::FunctionTemplate> constructor;
  };

}
#endif /* end of include guard: WRAPPEDFACTORY_H_F458F326 */
